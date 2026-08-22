'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

let db = null;
let SurveyResponse = null;
let dbReady = false;

// ═══════════════════════════════════════════════════════
//  Try connecting to DB (non-blocking)
// ═══════════════════════════════════════════════════════
async function initDB() {
    try {
        const models = require('./models');
        await models.sequelize.authenticate();
        await models.sequelize.sync({ force: false });
        db = models.sequelize;
        SurveyResponse = models.SurveyResponse;
        dbReady = true;
        console.log('✅ Database connected and tables synced!');
    } catch (err) {
        console.error('⚠️  DB connection failed:', err.message);
        console.error('Server running WITHOUT database. Set DATABASE_URL env variable!');
        dbReady = false;
    }
}

function requireDB(req, res, next) {
    if (!dbReady) {
        return res.status(503).json({
            error: 'Database not connected',
            hint: 'Set DATABASE_URL environment variable in Railway Variables',
        });
    }
    next();
}

// ═══════════════════════════════════════════════════════
//  Helpers
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
    const daily = {};
    responses.forEach(r => {
        const day = (r.submitted_at || r.createdAt || '').toString().slice(0, 10);
        if (day) daily[day] = (daily[day] || 0) + 1;
    });
    const timeline = Object.entries(daily)
        .sort((a, b) => a[0].localeCompare(b[0])).slice(-30)
        .map(([date, count]) => ({ date, count }));
    return {
        total: responses.length,
        demographics: {
            profession: countField('profession'), age: countField('age'),
            education: countField('education'),   admin_unit: countField('admin_unit'),
        },
        governance:   likertTally('gov',   4),
        conflict:     likertTally('conf',  4),
        native_admin: likertTally('ahli',  4),
        state_role:   likertTally('state', 4),
        timeline,
    };
}

// ═══════════════════════════════════════════════════════
//  Middleware
// ═══════════════════════════════════════════════════════
app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','x-admin-key'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

// ═══════════════════════════════════════════════════════
//  Routes
// ═══════════════════════════════════════════════════════
app.get('/', (req, res) => {
    res.json({
        status: 'online', service: 'Zalingei Survey API v2', database: dbReady ? 'connected' : 'NOT CONNECTED - set DATABASE_URL',
        endpoints: {
            'GET  /api/health': 'Health check',
            'GET  /api/responses': 'All responses',
            'POST /api/responses': 'Submit response',
            'GET  /api/stats': 'Statistics',
            'GET  /api/export': 'Export JSON',
        },
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/health', async (req, res) => {
    if (!dbReady) {
        return res.status(503).json({
            status: 'unhealthy',
            database: 'not connected',
            hint: 'Add DATABASE_URL to Railway Variables → server-1 → Variables',
            timestamp: new Date().toISOString(),
        });
    }
    try {
        const total = await SurveyResponse.count();
        res.json({ status: 'healthy', database: 'connected', total, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: 'error', error: err.message });
    }
});

app.get('/api/responses', requireDB, async (req, res) => {
    try {
        const { profession, age, limit } = req.query;
        const where = {};
        if (profession) where.profession = profession;
        if (age)        where.age        = age;
        const rows = await SurveyResponse.findAll({ where, order: [['submitted_at','DESC']], limit: limit ? parseInt(limit) : undefined });
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/responses/:id', requireDB, async (req, res) => {
    try {
        const row = await SurveyResponse.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/responses', requireDB, async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });
        const record = await SurveyResponse.create({
            respondent_name: body.respondent_name || null,
            profession:      body.profession      || null,
            age:             body.age             || null,
            education:       body.education       || null,
            admin_unit:      body.admin_unit       || null,
            ...extractLikertFields(body),
            raw_data: body, submitted_at: new Date(),
        });
        res.status(201).json({ success: true, id: record.id, message: 'تم حفظ الاستجابة بنجاح' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/responses/all', requireDB, async (req, res) => {
    try {
        const adminKey = process.env.ADMIN_KEY;
        if (adminKey && req.headers['x-admin-key'] !== adminKey) return res.status(403).json({ error: 'Unauthorized' });
        await SurveyResponse.destroy({ where: {} });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/responses/:id', requireDB, async (req, res) => {
    try {
        const row = await SurveyResponse.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });
        await row.destroy();
        res.json({ success: true, deleted: row });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', requireDB, async (req, res) => {
    try {
        const rows = await SurveyResponse.findAll();
        res.json(computeStats(rows));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export', requireDB, async (req, res) => {
    try {
        const rows  = await SurveyResponse.findAll({ order: [['submitted_at','DESC']] });
        const stats = computeStats(rows);
        res.setHeader('Content-Disposition', 'attachment; filename=zalingei_export.json');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({ exported_at: new Date().toISOString(), total: rows.length, stats, responses: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found', path: req.path }));

// ═══════════════════════════════════════════════════════
//  Start - Server starts immediately, DB connects async
// ═══════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET - add to Railway Variables!'}`);
});

// Connect to DB after server is up
initDB();

module.exports = app;
