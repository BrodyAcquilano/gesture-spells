import { createContext, useContext } from 'react'

export const DataContext = createContext(null)

// Library files, spells and takes, shared by every mode and tab.
export function useData() {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData must be used inside <DataProvider>')
  return data
}
