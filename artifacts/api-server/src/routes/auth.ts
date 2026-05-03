import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.json(GetCurrentAuthUserResponse.parse({ user: null }));
    return;
  }
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: {
        id: auth.userId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      },
    }),
  );
});

export default router;
