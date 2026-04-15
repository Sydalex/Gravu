import { create } from 'zustand';

// Path 1 (`full`) is Photo-to-Vector Generation: photo -> AI linework PNG.
// Path 2 (`vectorize_only`) is Vectorize Linework: drawing -> SVG/DXF immediately.
export type FlowType = 'full' | 'vectorize_only';
export type ProcessingMode = 'extract_all' | 'keep_together';
export type ViewAngle = 'perspective' | 'top' | 'side' | 'custom';
export type SimplificationLevel = 'low' | 'mid' | 'high';
// Export vectorization mode used by result exports and vectorize-only uploads.
export type VectorizeMode = 'centerline' | 'outline';

export interface Subject {
  id: number;
  description: string;
  selected: boolean;
  // If this subject was formed by merging others, list the original IDs absorbed into it
  mergedIds?: number[];
}

interface ImageStore {
  // Flow
  flowType: FlowType | null;
  setFlowType: (flow: FlowType) => void;

  // Image
  imageUri: string | null;
  imageFile: File | null;
  imageName: string | null;
  setImage: (uri: string, file: File, name: string) => void;

  // Subject detection
  detectedSubjects: Subject[] | null;
  setDetectedSubjects: (subjects: Subject[]) => void;
  toggleSubject: (id: number) => void;
  mergeSubjects: (ids: number[], mergedLabel: string) => void;
  unmergeSubject: (id: number) => void;

  // Processing settings
  viewAngle: ViewAngle;
  setViewAngle: (angle: ViewAngle) => void;
  customViewDescription: string | null;
  setCustomViewDescription: (desc: string) => void;
  processingMode: ProcessingMode;
  setProcessingMode: (mode: ProcessingMode) => void;
  simplificationLevel: SimplificationLevel;
  setSimplificationLevel: (level: SimplificationLevel) => void;
  vectorizeMode: VectorizeMode;
  setVectorizeMode: (mode: VectorizeMode) => void;

  // Results
  resultImages: Array<{ subjectId: number; imageBase64: string; title: string }> | null;
  setResultImages: (results: Array<{ subjectId: number; imageBase64: string; title: string }>) => void;

  // Cached exports
  cachedSvg: Record<number, string>;
  setCachedSvg: (subjectId: number, svg: string) => void;
  cachedDxf: Record<number, string>;
  setCachedDxf: (subjectId: number, dxf: string) => void;

  // Saved conversion tracking (for writing vector results back to DB)
  savedConversionId: string | null;
  savedAssetIds: Record<number, string>; // subjectId → DB asset id
  setSavedConversion: (conversionId: string, assetIds: Record<number, string>) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  flowType: null as FlowType | null,
  imageUri: null as string | null,
  imageFile: null as File | null,
  imageName: null as string | null,
  detectedSubjects: null as Subject[] | null,
  viewAngle: 'perspective' as ViewAngle,
  customViewDescription: null as string | null,
  processingMode: 'extract_all' as ProcessingMode,
  simplificationLevel: 'mid' as SimplificationLevel,
  vectorizeMode: 'centerline' as VectorizeMode,
  resultImages: null as Array<{ subjectId: number; imageBase64: string; title: string }> | null,
  cachedSvg: {} as Record<number, string>,
  cachedDxf: {} as Record<number, string>,
  savedConversionId: null as string | null,
  savedAssetIds: {} as Record<number, string>,
};

export const useImageStore = create<ImageStore>((set, get) => ({
  ...initialState,

  setFlowType: (flow) => set({ flowType: flow }),

  setImage: (uri, file, name) =>
    set({ imageUri: uri, imageFile: file, imageName: name }),

  setDetectedSubjects: (subjects) => set({ detectedSubjects: subjects }),

  toggleSubject: (id) =>
    set((state) => ({
      detectedSubjects: state.detectedSubjects?.map((s) =>
        s.id === id ? { ...s, selected: !s.selected } : s
      ) ?? null,
    })),

  // Merge multiple subjects into one. The first id becomes the "primary" subject
  // with the given label; all other ids are absorbed and hidden.
  mergeSubjects: (ids: number[], mergedLabel: string) => {
    if (ids.length < 2) return;
    const subjects = get().detectedSubjects;
    if (!subjects) return;

    const primaryId = ids[0];
    const absorbed = ids.slice(1);

    const updated = subjects
      .map((s) => {
        if (s.id === primaryId) {
          return {
            ...s,
            description: mergedLabel,
            selected: true,
            mergedIds: [
              ...(s.mergedIds ?? []),
              ...absorbed,
            ],
          };
        }
        return s;
      })
      // Remove absorbed subjects from the list
      .filter((s) => !absorbed.includes(s.id));

    set({ detectedSubjects: updated });
  },

  // Unmerge: restore original subjects that were absorbed into this one
  unmergeSubject: (id: number) => {
    const subjects = get().detectedSubjects;
    if (!subjects) return;

    const subject = subjects.find((s) => s.id === id);
    if (!subject?.mergedIds?.length) return;

    // We don't have the original descriptions anymore, so we just re-detect.
    // For simplicity, just clear the mergedIds and reset description to a note.
    // The user will need to re-detect, but we can at least restore the IDs.
    // Best UX: just restore the absorbed items as "Subject N" placeholders.
    const restored: Subject[] = subject.mergedIds.map((absorbedId) => ({
      id: absorbedId,
      description: `Subject ${absorbedId}`,
      selected: true,
    }));

    const updated = subjects.flatMap((s) => {
      if (s.id === id) {
        // Restore this subject to original state (without mergedIds)
        const { mergedIds: _removed, ...rest } = s;
        void _removed;
        return [{ ...rest, description: `Subject ${s.id}` }, ...restored];
      }
      return [s];
    });

    set({ detectedSubjects: updated });
  },

  setViewAngle: (angle) => set({ viewAngle: angle }),
  setCustomViewDescription: (desc) => set({ customViewDescription: desc }),
  setProcessingMode: (mode) => set({ processingMode: mode }),
  setSimplificationLevel: (level) =>
    set((state) =>
      state.simplificationLevel === level
        ? {}
        : {
            simplificationLevel: level,
            cachedSvg: {},
            cachedDxf: {},
          }
    ),
  setVectorizeMode: (mode) =>
    set((state) =>
      state.vectorizeMode === mode
        ? {}
        : {
            vectorizeMode: mode,
            cachedSvg: {},
            cachedDxf: {},
          }
    ),

  setResultImages: (results) => set({ resultImages: results }),

  setCachedSvg: (subjectId, svg) =>
    set((state) => ({
      cachedSvg: { ...state.cachedSvg, [subjectId]: svg },
    })),

  setCachedDxf: (subjectId, dxf) =>
    set((state) => ({
      cachedDxf: { ...state.cachedDxf, [subjectId]: dxf },
    })),

  setSavedConversion: (conversionId, assetIds) =>
    set({ savedConversionId: conversionId, savedAssetIds: assetIds }),

  reset: () => set(initialState),
}));
