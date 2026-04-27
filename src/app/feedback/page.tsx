'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImprovementRequest } from '@/lib/types'
import {
  RefreshCw, Send, ImagePlus, Link as LinkIcon, X, Trash2, ExternalLink,
  MessageSquarePlus,
} from 'lucide-react'

const BUCKET = 'improvement-images'
const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function FeedbackPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ImprovementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [myEmail, setMyEmail] = useState<string | null>(null)
  const [myName, setMyName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* 현재 유저 정보 + admin 여부 */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyEmail(user.email ?? null)
      setMyName(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null)
      const { data } = await supabase
        .from('allowed_users')
        .select('role, is_active')
        .eq('email', user.email ?? '')
        .single()
      setIsAdmin(data?.role === 'admin' && data?.is_active === true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from('improvement_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        setFetchError(`${error.message} (code: ${error.code})`)
        setItems([])
      } else {
        setItems((data ?? []) as ImprovementRequest[])
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setFetchError(`예상치 못한 오류: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  /* 이미지 파일 선택 */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const remaining = MAX_IMAGES - images.length
    const accepted = files.slice(0, remaining).filter(f => {
      if (!f.type.startsWith('image/')) {
        setSubmitError('이미지 파일만 첨부 가능합니다.')
        return false
      }
      if (f.size > MAX_IMAGE_BYTES) {
        setSubmitError(`이미지 크기는 5MB 이하여야 합니다 (${f.name})`)
        return false
      }
      return true
    })

    if (accepted.length === 0) return
    if (files.length > remaining) {
      setSubmitError(`이미지는 최대 ${MAX_IMAGES}개까지 첨부 가능합니다.`)
    } else {
      setSubmitError(null)
    }

    setImages(prev => [...prev, ...accepted])
    setImagePreviews(prev => [...prev, ...accepted.map(f => URL.createObjectURL(f))])

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  /* 등록 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setSubmitError('개선사항 내용을 입력해주세요.')
      return
    }
    if (!myEmail) {
      setSubmitError('로그인 정보를 확인할 수 없습니다.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)

    try {
      // 이미지 업로드
      const imageUrls: string[] = []
      for (const file of images) {
        const ext = file.name.split('.').pop() ?? 'png'
        const path = `${myEmail}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) {
          throw new Error(`이미지 업로드 실패: ${upErr.message}`)
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
        imageUrls.push(urlData.publicUrl)
      }

      const payload = {
        user_email: myEmail,
        user_name: myName,
        content: content.trim(),
        link: link.trim() || null,
        image_urls: imageUrls,
      }

      const { data, error } = await supabase
        .from('improvement_requests')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      setItems(prev => [data as ImprovementRequest, ...prev])
      // 폼 초기화
      setContent('')
      setLink('')
      imagePreviews.forEach(URL.revokeObjectURL)
      setImages([])
      setImagePreviews([])
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  /* 삭제 (본인 또는 관리자) */
  async function handleDelete(item: ImprovementRequest) {
    const canDelete = item.user_email === myEmail || isAdmin
    if (!canDelete) return
    if (!confirm('이 개선사항 요청을 삭제할까요?')) return

    // 첨부 이미지 storage에서도 삭제
    if (item.image_urls?.length) {
      const paths = item.image_urls
        .map(url => {
          const idx = url.indexOf(`/${BUCKET}/`)
          return idx >= 0 ? url.slice(idx + BUCKET.length + 2) : null
        })
        .filter((p): p is string => !!p)
      if (paths.length) {
        await supabase.storage.from(BUCKET).remove(paths)
      }
    }

    await supabase.from('improvement_requests').delete().eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  /* 링크 정규화 (스킴 없으면 https:// 추가) */
  function normalizeLink(raw: string) {
    if (/^https?:\/\//i.test(raw)) return raw
    return `https://${raw}`
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquarePlus size={24} className="text-blue-600" />
            개선사항 요청
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            본 프로그램의 개선사항이나 새로운 아이디어를 자유롭게 등록해주세요.
            전체 <span className="font-semibold text-gray-700">{items.length}건</span>
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 등록 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
            {myName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-800">{myName ?? '...'}</p>
            <p className="text-xs text-gray-400">{myEmail ?? ''}</p>
          </div>
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="개선했으면 하는 점이나 새로운 아이디어를 자유롭게 작성해주세요."
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
        />

        {/* 링크 입력 */}
        <div className="mt-3 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300">
          <LinkIcon size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="url"
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="참고 링크 (선택사항) — 예: https://example.com"
            className="flex-1 text-sm focus:outline-none"
          />
        </div>

        {/* 이미지 미리보기 */}
        {imagePreviews.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {imagePreviews.map((src, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={src}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 액션 버튼 영역 */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= MAX_IMAGES}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ImagePlus size={14} />
              이미지 첨부 ({images.length}/{MAX_IMAGES})
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={14} />
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>

        {submitError && (
          <p className="mt-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}
      </form>

      {/* 목록 */}
      {fetchError ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="text-red-500 text-sm font-medium">⚠️ 데이터를 불러오지 못했습니다</div>
          <div className="text-red-400 text-xs bg-red-50 border border-red-200 rounded px-4 py-2 max-w-lg text-center">
            {fetchError}
          </div>
          <div className="text-gray-500 text-xs text-center mt-1">
            Supabase SQL Editor에서{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">migration_improvement_requests.sql</code>을 먼저 실행하세요
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400 text-sm">
          아직 등록된 개선사항이 없습니다. 첫 번째 의견을 남겨주세요!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const canDelete = item.user_email === myEmail || isAdmin
            const isMine = item.user_email === myEmail
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">
                      {(item.user_name ?? item.user_email)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {item.user_name ?? item.user_email}
                        {isMine && <span className="ml-1.5 text-[10px] text-blue-500 font-semibold">(나)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{fmtDateTime(item.created_at)}</p>
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-3">
                  {item.content}
                </p>

                {item.link && (
                  <a
                    href={normalizeLink(item.link)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline break-all"
                  >
                    <LinkIcon size={12} />
                    {item.link}
                    <ExternalLink size={10} />
                  </a>
                )}

                {item.image_urls && item.image_urls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.image_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
