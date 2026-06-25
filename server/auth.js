async function authMiddleware(req, res, next) {
  const token = req.cookies?.session;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(payload.userId);
    if (!user) {
      req.user = null;
      return next();
    }
    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      status: user.status,
      role: user.role,
    };
    next();
  } catch {
    req.user = null;
    next();
  }
}
