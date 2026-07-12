/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import bootstrapRoutes from './routes/bootstrap.js'
import conversationsRoutes from './routes/conversations.js'
import messagesRoutes from './routes/messages.js'
import teamsRoutes from './routes/teams.js'
import usersRoutes from './routes/users.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()
const serverStartTime = Date.now()
const clientDistPath = path.resolve(__dirname, '../dist')
const clientIndexPath = path.join(clientDistPath, 'index.html')

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/bootstrap', bootstrapRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/conversations', conversationsRoutes)
app.use('/api/messages', messagesRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (_req: Request, res: Response, _next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      startTime: serverStartTime,
    })
  },
)

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      next()
      return
    }

    res.sendFile(clientIndexPath)
  })
}

/**
 * error handler middleware
 */
app.use((_error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
