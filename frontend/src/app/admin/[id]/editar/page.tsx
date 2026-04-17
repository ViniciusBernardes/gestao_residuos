'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CancelToDashboard } from '@/components/CancelToDashboard';
import { api, apiBlobAllow404, apiUpload, getToken } from '@/lib/api';
import { canEdit, canView } from '@/lib/permissions';

type TenantRow = {
  name: string;
  slug: string;
  cnpj: string | null;
  active: boolean;
  coatOfArmsFilePath: string | null;
  coatOfArmsOriginalName: string | null;
};

export default function AdminMunicipioEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [err, setErr] = useState('');
  const [slug, setSlug] = useState('');
  const [coatMsg, setCoatMsg] = useState('');
  const [coatPreview, setCoatPreview] = useState<string | null>(null);
  const coatPreviewRef = useRef<string | null>(null);
  const [coatFile, setCoatFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    active: true,
  });
  const canRead = canView('admin');
  const canSave = canEdit('admin');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    if (!canRead) {
      router.replace('/admin');
    }
  }, [router, canRead]);

  const refreshCoatPreview = useCallback(async () => {
    if (coatPreviewRef.current) {
      URL.revokeObjectURL(coatPreviewRef.current);
      coatPreviewRef.current = null;
    }
    setCoatPreview(null);
    const blob = await apiBlobAllow404(`/tenants/${id}/coat-of-arms`).catch(() => null);
    if (!blob || blob.size === 0) return;
    const url = URL.createObjectURL(blob);
    coatPreviewRef.current = url;
    setCoatPreview(url);
  }, [id]);

  useEffect(() => {
    if (!getToken() || !canRead) return;
    api<TenantRow>(`/tenants/${id}`)
      .then((r) => {
        setSlug(r.slug);
        setForm({
          name: r.name,
          cnpj: r.cnpj ?? '',
          active: r.active,
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [id, canRead]);

  useEffect(() => {
    if (!getToken() || !canRead || !id) return;
    refreshCoatPreview().catch(() => {});
    return () => {
      if (coatPreviewRef.current) {
        URL.revokeObjectURL(coatPreviewRef.current);
        coatPreviewRef.current = null;
      }
    };
  }, [id, canRead, refreshCoatPreview]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setErr('');
    try {
      await api(`/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          cnpj: form.cnpj.trim(),
          active: form.active,
        }),
      });
      router.push('/admin');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro');
    }
  }

  async function uploadCoat() {
    if (!canSave || !coatFile) return;
    setCoatMsg('');
    try {
      await apiUpload(`/tenants/${id}/coat-of-arms`, coatFile);
      setCoatFile(null);
      await refreshCoatPreview();
      setCoatMsg('Brasão atualizado.');
    } catch (ex) {
      setCoatMsg(ex instanceof Error ? ex.message : 'Erro ao enviar');
    }
  }

  if (!getToken() || !canRead) return null;

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand-700 hover:underline">
        ← Listagem
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar município</h1>
      {err && <p className="text-red-600 text-sm my-4">{err}</p>}
      <form
        onSubmit={submit}
        className="mt-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <label className="text-xs text-slate-600">Nome</label>
          <input
            required
            disabled={!canSave}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Slug</label>
          <input
            readOnly
            className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600"
            value={slug}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">CNPJ</label>
          <input
            disabled={!canSave}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            disabled={!canSave}
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativo
        </label>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600">Brasão (menu e relatórios)</p>
          <p className="text-xs text-slate-500 mt-0.5">
            PNG, JPEG, WebP ou GIF — até 4&nbsp;MB.
          </p>
          {coatPreview ? (
            <div className="mt-2 flex justify-start">
              <img
                src={coatPreview}
                alt="Brasão atual"
                className="h-16 w-auto max-w-[120px] object-contain rounded border border-slate-200 bg-slate-50 p-1"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-2">Nenhum brasão cadastrado.</p>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={!canSave}
            className="mt-2 block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-800 disabled:opacity-50"
            onChange={(e) => {
              setCoatMsg('');
              const f = e.target.files?.[0];
              setCoatFile(f ?? null);
            }}
          />
          {canSave ? (
            <button
              type="button"
              disabled={!coatFile}
              onClick={() => void uploadCoat()}
              className="mt-2 rounded-lg bg-slate-800 text-white px-3 py-1.5 text-xs disabled:bg-slate-300"
            >
              Enviar brasão
            </button>
          ) : null}
          {coatMsg ? <p className="text-xs mt-2 text-slate-600">{coatMsg}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {canSave ? (
            <button type="submit" className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm">
              Salvar
            </button>
          ) : (
            <p className="text-sm text-slate-600">Sem permissão para alterar dados.</p>
          )}
          <CancelToDashboard />
        </div>
      </form>
    </div>
  );
}
