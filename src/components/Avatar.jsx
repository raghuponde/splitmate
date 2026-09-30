import { useEffect, useState } from 'react'

const DEFAULT_AVATAR = '/default-avatar.png'

// Round profile photo; falls back to the default avatar when there is no photo or it fails to load.
function Avatar({ name, src, size = 32, decorative = false, className = '' }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <img
      src={!src || failed ? DEFAULT_AVATAR : src}
      alt={decorative ? '' : name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  )
}

export default Avatar
