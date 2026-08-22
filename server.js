'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const { sequelize, SurveyResponse } = require('./models');

const app  = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════
//  Helper: extract Likert fields from body
// ═══════════════════════════════════════════════════════
function extractLikertFields(body) {
    const fields = {};
    ['gov','conf','ahli','state'].forEach(g => {
        for (let i = 1; i <= 4; i++) {
            const key = `${g}_q${i}`;
            if (body[key] !== undefined) fields[key] = body[key];
        }
    });
    return fields;
}

// ═══════════════════════════════════════════════════════
//  Stats computation
// ═══════════════════════════════════════════════════════
function computeStats(responses) {
    const countField = (field) => {
        const counts = {};
        responses.forEach(r => {
            const v = r.raw_data?.[field] || r[field];
            if (v) counts[v] = (counts[v] || 0) + 1;
        });
        return counts;
    };

    const likertTally = (prefix, n) => {
        const tally = {};
        for (let i = 1; i <= n; i++) {
            const key = `${prefix}_q${i}`;
            responses.forEach(r => {
                const v = r[key] || r.raw_data?.[key];
                if (v) tally[v] = (tally[v] || 0) + 1;
            });
        }
        return tally;
    };

    const governance   = likertTally('gov',   4);
    const conflict     = likertTally('conf',  4);
    const native_admin = likertTally('ahli',  4);
    const state_role   = likertTally('state', 4);

    const daily = {};
    responses.forEach(r => {
        const day = (r.submitted_at || r.createdAt || '').toString().slice(0, 10);
        if (day) daily[day] = (daily[day] || 0) + 1;
    });
    const timeline = Object.entries(daily)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-30)
        .map(([date, count]) => ({ date, count }));

    return {
        total: responses.length,
        demographics: {
            profession: countField('profession'),
            age:        countField('age'),
            education:  countField('education'),
            admin_unit: countField('admin_unit'),
        },
        governance,
        conflict,
        native_admin,
        state_role,
        timeline,
    };
}

// ═══════════════════════════════════════════════════════
//  Middleware
// ═══════════════════════════════════════════════════════
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ═══════════════════════════════════════════════════════
//  Routes
// ═══════════════════════════════════════════════════════
app.get('/', (req, res) => {
    res.json({
        status: 'online', service: 'Zalingei Survey API', version: '2.0.0',
        database: 'PostgreSQL + Sequelize',
        endpoints: {
            'GET  /api/health':          'Health check',
            'GET  /api/responses':       'All survey responses',
            'GET  /api/responses/:id':   'Single response',
            'POST /api/responses':       'Submit new response',
            'DELETE /api/responses/all': 'Clear all (admin)',
            'DELETE /api/responses/:id': 'Delete response',
            'GET  /api/stats':           'Computed statistics',
            'GET  /api/export':          'Export JSON',
        },
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        const total = await SurveyResponse.count();
        res.json({ status: 'healthy', database: 'connected', total, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: 'error', error: err.message });
    }
});

app.get('/api/responses', async (req, res) => {
    try {
        const { profession, age, limit } = req.query;
        const where = {};
        if (profession) where.profession = profession;
        if (age)        where.age        = age;
        const rows = await SurveyResponse.findAll({
            where, order: [['submitted_at', 'DESC']],
            limit: limit ? parseInt(limit) : undefined,
        });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/responses/:id', async (req, res) => {
    try {
        const row = await SurveyResponse.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'الاستجابة غير موجودة' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/responses', async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ error: 'يرجى إرسال JSON صالح' });
        }
        const likertFields = extractLikertFields(body);
        const record = await SurveyResponse.create({
            respondent_name: body.respondent_name || null,
            profession:      body.profession      || null,
            age:             body.age             || null,
            education:       body.education       || null,
            admin_unit:      body.admin_unit       || null,
            ...likertFields,
            raw_data:     body,
            submitted_at: new Date(),
        });
        console.log(`New response: ${record.id}`);
        res.status(201).json({ success: true, id: record.id, message: 'تم حفظ الاستجابة بنجاح' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/responses/all', async (req, res) => {
    try {
        const adminKey = process.env.ADMIN_KEY;
        if (adminKey && req.headers['x-admin-key'] !== adminKey) {
            return res.status(403).json({ error: 'غير مصرح' });
        }
        await SurveyResponse.destroy({ where: {} });
        res.json({ success: true, message: 'تم حذف جميع الاستجابات' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/responses/:id', async (req, res) => {
    try {
        const row = await SurveyResponse.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'الاستجابة غير موجودة' });
        await row.destroy();
        res.json({ success: true, deleted: row });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const rows = await SurveyResponse.findAll();
        res.json(computeStats(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export', async (req, res) => {
    try {
        const rows  = await SurveyResponse.findAll({ order: [['submitted_at', 'DESC']] });
        const stats = computeStats(rows);
        const data  = { exported_at: new Date().toISOString(), total: rows.length, stats, responses: rows };
        res.setHeader('Content-Disposition', 'attachment; filename=zalingei_survey_export.json');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use((req, res) => {
    res.status(404).json({ error: 'المسار غير موجود', path: req.path });
});

// ═══════════════════════════════════════════════════════
//  Start Server - Auto-sync tables on startup
// ═══════════════════════════════════════════════════════
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to PostgreSQL');

        // Creates tables automatically if they do not exist
        await sequelize.sync({ force: false });
        console.log('✅ Tables synchronized successfully');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🗄️  Database: PostgreSQL`);
            console.log(`❤️  Health: GET /api/health`);
        });
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error(err);
        process.exit(1);
    }
})();

module.exports = app;
