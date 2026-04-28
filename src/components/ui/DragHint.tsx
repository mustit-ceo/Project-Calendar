'use client'

import { useEffect, useState } from 'react'

interface DragHintProps {
  /** absolute 위치 추가 스타일 (top/left 등 override) */
  style?: React.CSSProperties
  /** 표시 시간(ms), 기본 3000 */
  duration?: number
  /** 라벨, 기본 '드래그로 이동' */
  label?: string
}

/**
 * 간트/타임라인 등 마우스 드래그로 이동하는 영역에 일시적으로 표시되는 힌트.
 * 부모 요소를 `position: relative`로 감싸 사용.
 */
export function DragHint({
  style,
  duration = 3000,
  label = '드래그로 이동',
}: DragHintProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(t)
  }, [duration])

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease-out',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 22px',
          borderRadius: 20,
          backgroundColor: 'rgba(17, 24, 39, 0.7)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          backdropFilter: 'blur(6px)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="20" height="14" viewBox="0 0 14 10" fill="none" style={{ opacity: 0.85 }}>
          <path d="M1 5h12M1 5l3-3M1 5l3 3M13 5l-3-3M13 5l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {label}
      </div>
    </div>
  )
}
