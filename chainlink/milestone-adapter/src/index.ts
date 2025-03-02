import express from 'express';
import bodyParser from 'body-parser';
import { create } from 'ipfs-http-client';
import axios from 'axios';

const app = express();
app.use(bodyParser.json());

const ipfs = create({ url: process.env.IPFS_NODE || 'https://ipfs.infura.io:5001/api/v0' });

interface VerificationRequirement {
    field: string;
    type: 'text' | 'number' | 'boolean' | 'file' | 'date';
    description: string;
    required: boolean;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        allowedFormats?: string[];
    };
}

interface VerificationCriteria {
    requirements: VerificationRequirement[];
    requiredConfidence: number;
    deadline?: number;
    customValidation?: {
        script?: string;
        parameters?: Record<string, any>;
    };
}

interface ProofSubmission {
    fields: Record<string, any>;
    timestamp: number;
    submitter: string;
    attachments?: {
        cid: string;
        type: string;
    }[];
}

interface JobRequest {
    id: string;
    data: {
        proofCID: string;
        verificationCID: string;
    };
}

interface JobResponse {
    jobRunID: string;
    data: {
        verified: boolean;
        confidence?: number;
        details?: {
            passedRequirements: string[];
            failedRequirements: string[];
        };
    };
    error?: string;
}

const validateField = (value: any, requirement: VerificationRequirement): boolean => {
    if (requirement.required && (value === undefined || value === null)) {
        return false;
    }

    if (value === undefined || value === null) {
        return !requirement.required;
    }

    switch (requirement.type) {
        case 'number':
            if (typeof value !== 'number') return false;
            if (requirement.validation) {
                const { min, max } = requirement.validation;
                if (min !== undefined && value < min) return false;
                if (max !== undefined && value > max) return false;
            }
            break;

        case 'text':
            if (typeof value !== 'string') return false;
            if (requirement.validation?.pattern) {
                const regex = new RegExp(requirement.validation.pattern);
                if (!regex.test(value)) return false;
            }
            break;

        case 'file':
            if (!value.cid || typeof value.cid !== 'string') return false;
            if (requirement.validation?.allowedFormats) {
                if (!requirement.validation.allowedFormats.includes(value.type)) {
                    return false;
                }
            }
            break;

        case 'date':
            const date = new Date(value);
            if (isNaN(date.getTime())) return false;
            break;
    }

    return true;
};

const verifyMilestone = async (proofCID: string, verificationCID: string): Promise<JobResponse['data']> => {
    try {
        const proofRes = await axios.get(`https://ipfs.io/ipfs/${proofCID}`);
        const verificationRes = await axios.get(`https://ipfs.io/ipfs/${verificationCID}`);

        const proof: ProofSubmission = proofRes.data;
        const criteria: VerificationCriteria = verificationRes.data;

        if (!proof || !criteria || !criteria.requirements) {
            throw new Error('Invalid proof or verification criteria format');
        }

        // Check submission deadline if specified
        if (criteria.deadline && proof.timestamp > criteria.deadline) {
            return {
                verified: false,
                confidence: 0,
                details: {
                    passedRequirements: [],
                    failedRequirements: ['Submission deadline exceeded']
                }
            };
        }

        const passedRequirements: string[] = [];
        const failedRequirements: string[] = [];

        // Validate each requirement
        for (const requirement of criteria.requirements) {
            const value = proof.fields[requirement.field];
            const isValid = validateField(value, requirement);

            if (isValid) {
                passedRequirements.push(requirement.field);
            } else {
                failedRequirements.push(requirement.field);
            }
        }

        // Calculate confidence score
        const confidence = (passedRequirements.length / criteria.requirements.length) * 100;
        const verified = confidence >= (criteria.requiredConfidence || 100);

        // Execute custom validation if present
        if (verified && criteria.customValidation?.script) {
            try {
                // Safe eval of custom validation script with provided parameters
                const customValidationResult = new Function(
                    'proof',
                    'parameters',
                    criteria.customValidation.script
                )(proof, criteria.customValidation.parameters);

                if (!customValidationResult) {
                    failedRequirements.push('Custom validation failed');
                    return {
                        verified: false,
                        confidence,
                        details: { passedRequirements, failedRequirements }
                    };
                }
            } catch (error) {
                console.error('Custom validation error:', error);
                failedRequirements.push('Custom validation error');
                return {
                    verified: false,
                    confidence,
                    details: { passedRequirements, failedRequirements }
                };
            }
        }

        return {
            verified,
            confidence,
            details: {
                passedRequirements,
                failedRequirements
            }
        };
    } catch (error) {
        console.error('Verification error:', error);
        return {
            verified: false,
            confidence: 0,
            details: {
                passedRequirements: [],
                failedRequirements: ['Internal verification error']
            }
        };
    }
};

app.post('/', async (req: JobRequest, res) => {
    const jobRunID = req.id;
    const { proofCID, verificationCID } = req.data;

    if (!proofCID || !verificationCID) {
        const response: JobResponse = {
            jobRunID,
            data: { 
                verified: false,
                confidence: 0,
                details: {
                    passedRequirements: [],
                    failedRequirements: ['Missing required parameters']
                }
            },
            error: 'Missing required parameters'
        };
        return res.status(400).json(response);
    }

    try {
        const verificationResult = await verifyMilestone(proofCID, verificationCID);
        const response: JobResponse = {
            jobRunID,
            data: verificationResult
        };
        
        res.json(response);
    } catch (error) {
        const response: JobResponse = {
            jobRunID,
            data: {
                verified: false,
                confidence: 0,
                details: {
                    passedRequirements: [],
                    failedRequirements: ['Internal verification error']
                }
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