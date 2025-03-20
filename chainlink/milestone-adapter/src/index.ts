import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

interface JobRequest {
    id: string;
    data: {
        submittedProof: string;
        verificationCriteria: string;
    };
}

interface JobResponse {
    jobRunID: string;
    data: {
        result: boolean;
    };
    error?: string;
}

const verifyMilestone = (submittedProof: string, verificationCriteria: string): boolean => {
    // Direct string comparison since we're now using on-chain criteria
    return submittedProof === verificationCriteria;
};

app.post('/', async (req: JobRequest, res) => {
    const jobRunID = req.id;
    const { submittedProof, verificationCriteria } = req.data;

    if (!submittedProof || !verificationCriteria) {
        const response: JobResponse = {
            jobRunID,
            data: { 
                result: false
            },
            error: 'Missing required parameters'
        };
        return res.status(400).json(response);
    }

    try {
        const verified = verifyMilestone(submittedProof, verificationCriteria);
        const response: JobResponse = {
            jobRunID,
            data: {
                result: verified
            }
        };
        
        res.json(response);
    } catch (error) {
        const response: JobResponse = {
            jobRunID,
            data: {
                result: false
            },
            error: error instanceof Error ? error.message : 'Internal verification error'
        };
        res.status(500).json(response);
    }
});

// Health check endpoint
app.get('/health', (_, res) => {
    res.json({ 
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Milestone verification adapter running on port ${PORT}`);
});