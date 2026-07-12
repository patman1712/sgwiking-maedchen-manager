import { Router, type Request, type Response } from 'express'
import { getBootstrapData } from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : null
  res.json({
    success: true,
    ...getBootstrapData(userId),
  })
})

export default router
