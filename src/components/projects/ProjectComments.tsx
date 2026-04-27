'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProjectComment } from '@/lib/types'
import { Send, Pencil, Trash2, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Props {
  projectId: string
}

function formatRelative(iso: string): string {
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return format(then, 'yyyy-MM-dd HH:mm', { locale: ko })
}

export function ProjectComments({ projectId }: Props) {
  const supabase = createClient()
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [me, setMe] = useState<{ email: string; name: string | null } | null>(null)

  // 현재 사용자 정보
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setMe({
          email: user.email,
          name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        })
      }
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (error) {
      setError(error.message)
      setComments([])
    } else {
      setComments((data ?? []) as ProjectComment[])
      setError(null)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handlePost = async () => {
    const content = newContent.trim()
    if (!content || !me) return
    setPosting(true)
    const { error } = await supabase
      .from('project_comments')
      .insert({
        project_id: projectId,
        author_email: me.email,
        author_name: me.name,
        content,
      })
    setPosting(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewContent('')
    await load()
  }

  const handleStartEdit = (c: ProjectComment) => {
    setEditingId(c.id)
    setEditContent(c.content)
  }

  const handleSaveEdit = async (id: string) => {
    const content = editContent.trim()
    if (!content) return
    const { error } = await supabase
      .from('project_comments')
      .update({ content })
      .eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setEditingId(null)
    setEditContent('')
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 코멘트를 삭제하시겠습니까?')) return
    const { error } = await supabase.from('project_comments').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      {/* 입력창 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="코멘트를 입력하세요... (Cmd/Ctrl + Enter 로 등록)"
          rows={3}
          className="w-full px-3 py-2 text-sm focus:outline-none resize-none"
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              handlePost()
            }
          }}
        />
        <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            {me ? `${me.name ?? me.email} 으로 작성` : '로그인 필요'}
          </span>
          <button
            onClick={handlePost}
            disabled={posting || !newContent.trim() || !me}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={12} />
            {posting ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
          <div className="text-red-500 mt-0.5">
            (마이그레이션 SQL 미적용일 수 있습니다)
          </div>
        </div>
      )}

      {/* 코멘트 목록 */}
      {loading ? (
        <div className="text-sm text-gray-400 py-4 text-center">불러오는 중...</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">
          첫 코멘트를 남겨보세요.
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map(c => {
            const isMine = me?.email === c.author_email
            const isEditing = editingId === c.id
            const wasEdited = c.updated_at && c.updated_at !== c.created_at
            return (
              <div
                key={c.id}
                className="border border-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {c.author_name ?? c.author_email}
                    </span>
                    <span
                      className="text-xs text-gray-400 flex-shrink-0"
                      title={format(new Date(c.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                    >
                      {formatRelative(c.created_at)}
                      {wasEdited && ' (수정됨)'}
                    </span>
                  </div>
                  {isMine && !isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleStartEdit(c)}
                        className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                        title="수정"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex items-center justify-end gap-2 mt-1.5">
                      <button
                        onClick={() => { setEditingId(null); setEditContent('') }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        <X size={11} /> 취소
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={!editContent.trim()}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Check size={11} /> 저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {c.content}
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
