import { useEffect } from 'react'

export const APP_NAME = 'Splitmate'

// Sets the browser tab title to "<title> | Splitmate". Pass a falsy title to leave it unchanged.
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} | ${APP_NAME}`
  }, [title])
}
