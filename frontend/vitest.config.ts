import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins:[react()], define:{'import.meta.env.VITE_STUDY_MODE':'"true"'}, test:{environment:'jsdom',include:['tests/components/*.test.tsx'],pool:'threads',maxWorkers:1,minWorkers:1} })
