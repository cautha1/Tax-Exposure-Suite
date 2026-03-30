import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import transactionsRouter from "./transactions";
import risksRouter from "./risks";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(transactionsRouter);
router.use(risksRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(uploadsRouter);

export default router;
