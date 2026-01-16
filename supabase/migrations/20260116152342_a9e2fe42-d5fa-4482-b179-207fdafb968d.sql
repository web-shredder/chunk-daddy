-- Create chunk_daddy_projects table for project persistence
CREATE TABLE public.chunk_daddy_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_name text NOT NULL,
  content text NOT NULL,
  queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.chunk_daddy_projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own projects
CREATE POLICY "Users can view own projects"
  ON public.chunk_daddy_projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can create own projects"
  ON public.chunk_daddy_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON public.chunk_daddy_projects
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON public.chunk_daddy_projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for fast lookups
CREATE INDEX chunk_daddy_projects_user_id_idx ON public.chunk_daddy_projects(user_id);
CREATE INDEX chunk_daddy_projects_updated_at_idx ON public.chunk_daddy_projects(updated_at DESC);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_chunk_daddy_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_chunk_daddy_projects_updated_at
  BEFORE UPDATE ON public.chunk_daddy_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chunk_daddy_projects_updated_at();