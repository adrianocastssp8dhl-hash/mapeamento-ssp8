import { Router, type IRouter } from "express";
import healthRouter from "./health";
import collaboratorsRouter from "./collaborators";
import scansRouter from "./scans";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(collaboratorsRouter);
router.use(scansRouter);
router.use(summaryRouter);

export default router;
