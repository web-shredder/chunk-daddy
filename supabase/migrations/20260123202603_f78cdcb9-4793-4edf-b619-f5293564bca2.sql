-- Add coverage_state column for persisting query optimization work
ALTER TABLE chunk_daddy_projects 
ADD COLUMN coverage_state jsonb DEFAULT NULL;