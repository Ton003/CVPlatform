-- Migration for ATS Rework

-- 1. candidate_career_entries
CREATE TABLE IF NOT EXISTS candidate_career_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    role_title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    start_date DATE,
    end_date DATE,
    sfia_tags JSONB DEFAULT '[]'::jsonb,
    raw_description TEXT,
    source VARCHAR(20) DEFAULT 'AI',
    confidence_score FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update job_roles
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES competence_families(id) ON DELETE SET NULL;
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS level SMALLINT DEFAULT 1;
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS sfia_requirements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS successor_role_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE job_roles ALTER COLUMN "domainId" DROP NOT NULL;

-- 3. Update job_offers
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS job_role_id UUID REFERENCES job_roles(id) ON DELETE SET NULL;
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS competency_overrides JSONB;
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS weight_overrides JSONB;

-- 4. Update candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS competency_snapshot JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS snapshot_updated_at TIMESTAMPTZ;

-- 5. Update applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS competency_delta JSONB;
