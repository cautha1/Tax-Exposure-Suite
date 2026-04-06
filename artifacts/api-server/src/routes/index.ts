import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import transactionsRouter from "./transactions";
import risksRouter from "./risks";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import uploadsRouter from "./uploads";
import analysisRouter from "./analysis";
import rulesRouter from "./rules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(transactionsRouter);
router.use(risksRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(uploadsRouter);
router.use(analysisRouter);
router.use(rulesRouter);

export default router;
