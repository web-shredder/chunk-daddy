import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { ChunkDaddyProject, ProjectSummary } from '@/lib/project-types';
import type { ChunkerOptions } from '@/lib/layout-chunker';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { FullOptimizationResult } from '@/lib/optimizer-types';

interface ProjectState {
  currentProject: ChunkDaddyProject | null;
  projects: ProjectSummary[];
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
}

interface UseProjectsOptions {
  autoSaveInterval?: number; // milliseconds, default 30000 (30 seconds)
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { autoSaveInterval = 30000 } = options;
  const { user } = useAuth();
  
  const [state, setState] = useState<ProjectState>({
    currentProject: null,
    projects: [],
    isLoading: false,
    isSaving: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });

  // Store current data for auto-save (avoid stale closures)
  const pendingData = useRef<{
    content: string;
    queries: string[];
    settings: ChunkerOptions;
    results: AnalysisResult | null;
    optimizedContent: string | null;
    optimizationResult: FullOptimizationResult | null;
  } | null>(null);

  // Fetch user's projects
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase
        .from('chunk_daddy_projects')
        .select('id, project_name, queries, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      setState(prev => ({
        ...prev,
        projects: (data || []).map(p => ({
          id: p.id,
          project_name: p.project_name,
          queries: (p.queries as string[]) || [],
          updated_at: p.updated_at,
        })),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Save project
  const saveProject = useCallback(async (
    projectName: string,
    content: string,
    queries: string[],
    settings: ChunkerOptions,
    results: AnalysisResult | null,
    existingId?: string,
    optimizedContent?: string | null,
    optimizationResult?: FullOptimizationResult | null
  ) => {
    if (!user) {
      toast.error('Please log in to save projects');
      return null;
    }

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const projectData = {
        user_id: user.id,
        project_name: projectName || `Untitled ${new Date().toLocaleString()}`,
        content,
        queries: queries as unknown as any,
        settings: settings as unknown as any,
        results: results as unknown as any,
        optimized_content: optimizedContent || null,
        optimization_result: optimizationResult as unknown as any,
      };

      let savedProject: ChunkDaddyProject;

      if (existingId) {
        // Update existing project
        const { data, error } = await supabase
          .from('chunk_daddy_projects')
          .update({
            ...projectData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .select()
          .single();

        if (error) throw error;
        savedProject = data as unknown as ChunkDaddyProject;
      } else {
        // Insert new project
        const { data, error } = await supabase
          .from('chunk_daddy_projects')
          .insert([projectData as any])
          .select()
          .single();

        if (error) throw error;
        savedProject = data as unknown as ChunkDaddyProject;
      }

      setState(prev => ({
        ...prev,
        currentProject: savedProject,
        hasUnsavedChanges: false,
        lastSavedAt: new Date(),
        isSaving: false,
      }));

      // Refresh project list
      fetchProjects();

      return savedProject;
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
      setState(prev => ({ ...prev, isSaving: false }));
      return null;
    }
  }, [user, fetchProjects]);

  // Quick save current project (for auto-save)
  const quickSave = useCallback(async () => {
    const data = pendingData.current;
    if (!data || !state.hasUnsavedChanges) return;

    const project = state.currentProject;
    await saveProject(
      project?.project_name || 'Untitled Project',
      data.content,
      data.queries,
      data.settings,
      data.results,
      project?.id,
      data.optimizedContent,
      data.optimizationResult
    );
  }, [state.currentProject, state.hasUnsavedChanges, saveProject]);

  // Load a specific project
  const loadProject = useCallback(async (projectId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase
        .from('chunk_daddy_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      const project = data as unknown as ChunkDaddyProject;
      
      setState(prev => ({
        ...prev,
        currentProject: project,
        hasUnsavedChanges: false,
        lastSavedAt: new Date(project.updated_at),
        isLoading: false,
      }));

      return project;
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, []);

  // Rename project
  const renameProject = useCallback(async (projectId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('chunk_daddy_projects')
        .update({ project_name: newName, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        currentProject: prev.currentProject?.id === projectId
          ? { ...prev.currentProject, project_name: newName }
          : prev.currentProject,
        projects: prev.projects.map(p =>
          p.id === projectId ? { ...p, project_name: newName } : p
        ),
      }));

      toast.success('Project renamed');
    } catch (error) {
      console.error('Error renaming project:', error);
      toast.error('Failed to rename project');
    }
  }, []);

  // Delete project
  const deleteProject = useCallback(async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('chunk_daddy_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        currentProject: prev.currentProject?.id === projectId ? null : prev.currentProject,
        projects: prev.projects.filter(p => p.id !== projectId),
      }));

      toast.success('Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  }, []);

  // Create new project (clear current)
  const newProject = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentProject: null,
      hasUnsavedChanges: false,
      lastSavedAt: null,
    }));
    pendingData.current = null;
  }, []);

  // Mark as having unsaved changes
  const markUnsaved = useCallback((
    content: string,
    queries: string[],
    settings: ChunkerOptions,
    results: AnalysisResult | null,
    optimizedContent?: string | null,
    optimizationResult?: FullOptimizationResult | null
  ) => {
    pendingData.current = { 
      content, 
      queries, 
      settings, 
      results, 
      optimizedContent: optimizedContent || null,
      optimizationResult: optimizationResult || null
    };
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (state.hasUnsavedChanges && pendingData.current) {
        quickSave();
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [user, state.hasUnsavedChanges, autoSaveInterval, quickSave]);

  return {
    ...state,
    fetchProjects,
    saveProject,
    quickSave,
    loadProject,
    renameProject,
    deleteProject,
    newProject,
    markUnsaved,
  };
}
