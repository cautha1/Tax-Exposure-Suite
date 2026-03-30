import { Router, type IRouter } from "express";
import { db, uploadsTable } from "../lib/db.js";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/uploads", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    const rows = companyId
      ? await db.select().from(uploadsTable).where(eq(uploadsTable.companyId, companyId)).orderBy(desc(uploadsTable.createdAt))
      : await db.select().from(uploadsTable).orderBy(desc(uploadsTable.createdAt));
    res.json(rows.map(u => ({
      id: u.id, companyId: u.companyId, fileName: u.fileName ?? null,
      rowCount: u.rowCount ?? null, status: u.status ?? null, createdAt: u.createdAt,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
