-- Add column for Query Intelligence state persistence
ALTER TABLE chunk_daddy_projects 
ADD COLUMN query_intelligence jsonb DEFAULT NULL;