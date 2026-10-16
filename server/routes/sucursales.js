import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sucursales ORDER BY id');
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
