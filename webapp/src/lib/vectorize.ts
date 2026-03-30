import { api, ApiError } from '@/lib/api';
import type { SimplificationLevel, VectorizeMode } from '@/lib/store';

export function base64ToPngFile(base64: string, filename: string): File {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: 'image/png' });
}

export async function vectorizeRaster(
  imageFile: File,
  mode: VectorizeMode,
  simplificationLevel: SimplificationLevel
): Promise<{ svg: string; dxf: string; previewBase64?: string }> {
  if (mode === 'outline') {
    const form = new FormData();
    form.append('image', imageFile);

    const res = await api.raw('/api/convert/vectorise-outline', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      throw new ApiError(
        errorJson?.error?.message ?? 'Outline vectorization failed',
        res.status,
        errorJson?.error ?? errorJson
      );
    }

    const json = (await res.json()) as {
      data: { svg: string; dxf: string; previewBase64?: string };
    };

    return json.data;
  }

  const form = new FormData();
  form.append('image', imageFile);
  form.append('simplification', simplificationLevel);

  const dxfRes = await api.raw('/api/convert/vectorise-ai', {
    method: 'POST',
    body: form,
  });

  if (!dxfRes.ok) {
    const errorJson = await dxfRes.json().catch(() => null);
    throw new ApiError(
      errorJson?.error?.message ?? 'Centerline vectorization failed',
      dxfRes.status,
      errorJson?.error ?? errorJson
    );
  }

  const dxfJson = (await dxfRes.json()) as {
    data: { dxf: string; preprocessedImageBase64?: string };
  };
  const dxf = dxfJson.data.dxf;
  const { svg } = await api.post<{ svg: string }>('/api/convert/dxf-to-svg', { dxf });

  return {
    svg,
    dxf,
    previewBase64: dxfJson.data.preprocessedImageBase64,
  };
}
