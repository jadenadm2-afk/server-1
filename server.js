'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

let db = null;
let SurveyResponse = null;
let dbReady = false;

// ═══════════════════════════════════════════════════════
//  DB Initialization
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
        console.error('⚠️ DB connection error:', err.message);
        dbReady = false;
    }
}

function requireDB(req, res, next) {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database not connected' });
    }
    next();
}

// ═══════════════════════════════════════════════════════
//  Label Mappings & Helpers
// ═══════════════════════════════════════════════════════
const OCCUPATION_MAP = {
    farmer: 'مزارع',
    pastoralist: 'راعي / مربي ماشية',
    agro_pastoralist: 'مزارع ورعوي معاً',
    other: 'أخرى',
};

const EDUCATION_MAP = {
    illiterate: 'أمي',
    khalwa: 'خلوة / قرآني',
    primary: 'ابتدائي / أساس',
    intermediate: 'متوسط',
    secondary: 'ثانوي',
    university: 'جامعي فما فوق',
    postgraduate: 'دراسات عليا',
};

const LIKERT_MAP = {
    strongly_agree: 'أوافق بشدة',
    agree: 'أوافق',
    neutral: 'محايد',
    disagree: 'لا أوافق',
    strongly_disagree: 'لا أوافق بشدة',
    satisfied: 'راضٍ تماماً',
    partially: 'راضٍ جزئياً',
    unsatisfied: 'غير راضٍ',
};

function translateVal(v, map) {
    if (!v) return null;
    return map[v] || v;
}

// ═══════════════════════════════════════════════════════
//  Stats Computation
// ═══════════════════════════════════════════════════════
function computeStats(responses) {
    const total = responses.length;

    // Demographics
    const profCounts = {}, ageCounts = {}, eduCounts = {}, unitCounts = {};

    responses.forEach(r => {
        const raw = r.raw_data || {};
        
        // Profession
        const rawProf = r.profession || raw.profession || raw.occupation;
        const prof = translateVal(rawProf, OCCUPATION_MAP) || 'غير محدد';
        profCounts[prof] = (profCounts[prof] || 0) + 1;

        // Age
        const age = r.age || raw.age || 'غير محدد';
        ageCounts[age] = (ageCounts[age] || 0) + 1;

        // Education
        const rawEdu = r.education || raw.education;
        const edu = translateVal(rawEdu, EDUCATION_MAP) || 'غير محدد';
        eduCounts[edu] = (eduCounts[edu] || 0) + 1;

        // Admin Unit
        const unit = r.admin_unit || raw.admin_unit || 'غير محدد';
        unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });

    // Helper for Likert Tallies
    const tallyAxis = (prefixList, maxQ) => {
        const tally = {};
        responses.forEach(r => {
            const raw = r.raw_data || {};
            prefixList.forEach(prefix => {
                for (let i = 1; i <= maxQ; i++) {
                    const key = `${prefix}_q${i}`;
                    const val = r[key] || raw[key];
                    if (val) {
                        const translated = translateVal(val, LIKERT_MAP);
                        tally[translated] = (tally[translated] || 0) + 1;
                    }
                }
            });
        });
        return tally;
    };

    const governance   = tallyAxis(['axis1', 'gov'], 4);
    const conflict     = tallyAxis(['axis2', 'conf'], 4);
    const native_admin = tallyAxis(['axis3', 'ahli'], 4);
    const state_role   = tallyAxis(['axis4', 'state'], 10);

    // Percentage of positive agreement in each axis
    function calcPositiveRate(tally) {
        const totalAnswers = Object.values(tally).reduce((a, b) => a + b, 0);
        if (!totalAnswers) return 0;
        const positiveCount = (tally['أوافق بشدة'] || 0) + (tally['أوافق'] || 0) + (tally['راضٍ تماماً'] || 0) + (tally['راضٍ جزئياً'] || 0);
        return Math.round((positiveCount / totalAnswers) * 100);
    }

    const axis_rates = {
        governance_approval: calcPositiveRate(governance),
        conflict_impact:     calcPositiveRate(conflict),
        native_admin_high:   calcPositiveRate(native_admin),
        state_satisfaction:  calcPositiveRate(state_role),
    };

    // Timeline (last 30 days)
    const daily = {};
    responses.forEach(r => {
        const d = r.submitted_at || r.createdAt;
        if (d) {
            const day = new Date(d).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
            daily[day] = (daily[day] || 0) + 1;
        }
    });

    const timeline = Object.entries(daily).map(([date, count]) => ({ date, count }));

    return {
        total,
        axis_rates,
        demographics: {
            profession: profCounts,
            age:        ageCounts,
            education:  eduCounts,
            admin_unit: unitCounts,
        },
        governance,
        conflict,
        native_admin,
        state_role,
        timeline,
    };
}

// ═══════════════════════════════════════════════════════
//  Middleware & Static Files
// ═══════════════════════════════════════════════════════
app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','x-admin-key'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════
//  UI Routes
// ═══════════════════════════════════════════════════════
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/survey', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════════════════════════════
//  API Routes
// ═══════════════════════════════════════════════════════
app.get('/api/health', async (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ status: 'unhealthy', database: 'not connected' });
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
        const rows = await SurveyResponse.findAll({ order: [['submitted_at', 'DESC']] });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/responses', requireDB, async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

        const record = await SurveyResponse.create({
            respondent_name: body.respondent_name || null,
            profession:      body.profession || body.occupation || null,
            age:             body.age             || null,
            education:       body.education       || null,
            admin_unit:      body.admin_unit       || null,
            raw_data:        body,
            submitted_at:    new Date(),
        });
        res.status(201).json({ success: true, id: record.id, message: 'تم الحفظ بنجاح' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/responses/all', requireDB, async (req, res) => {
    try {
        const adminKey = process.env.ADMIN_KEY;
        if (adminKey && req.headers['x-admin-key'] !== adminKey) return res.status(403).json({ error: 'Unauthorized' });
        await SurveyResponse.destroy({ where: {} });
        res.json({ success: true, message: 'Deleted all responses' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/responses/:id', requireDB, async (req, res) => {
    try {
        const row = await SurveyResponse.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });
        await row.destroy();
        res.json({ success: true, deleted: row });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', requireDB, async (req, res) => {
    try {
        const rows = await SurveyResponse.findAll();
        res.json(computeStats(rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export', requireDB, async (req, res) => {
    try {
        const rows = await SurveyResponse.findAll({ order: [['submitted_at', 'DESC']] });
        const stats = computeStats(rows);
        res.setHeader('Content-Disposition', 'attachment; filename=zalingei_survey_export.json');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({ exported_at: new Date().toISOString(), total: rows.length, stats, responses: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════
//  Start
// ═══════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

initDB();

module.exports = app;
