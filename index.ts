import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

const PORT = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use(cors());

const uri = process.env.MONGODB_URI as string;

if (!uri) {
  throw new Error("MONGODB_URI is not defined in .env");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.FRONTEND_URL}/api/auth/jwks`),
);

interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    role?: string;
  };
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized: no token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = {
      email: payload.email as string,
      role: (payload.role as string) || "user",
    };
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized: invalid token" });
  }
}

async function run() {
  // await client.connect();
  const database = client.db("petpulse");
  const productsCollection = database.collection("products");
  const ordersCollection = database.collection("orders");
  const usersCollection = database.collection("user");

  app.post(
    "/api/products",
    requireAuth,
    async (req: Request, res: Response) => {
      const newItem = req.body;
      const result = await productsCollection.insertOne({
        ...newItem,
        createdAt: new Date(),
      });
      res.send(result);
    },
  );

  app.get("/api/products", async (req: Request, res: Response) => {
    const cursor = productsCollection.find();

    const result = await cursor.toArray();

    res.send(result);
  });

  app.get("/api/products/mine", async (req: Request, res: Response) => {
    const { email } = req.query;

    if (!email) {
      return res.status(400).send({ message: "email is required" });
    }

    const result = await productsCollection
      .find({ createdBy: email as string })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const query = { _id: new ObjectId(id) };
    const result = await productsCollection.findOne(query);
    res.send(result);
  });

  app.delete(
    "/api/products/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid product id" });
      }

      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Product not found" });
      }

      res.send({ message: "Product deleted successfully" });
    },
  );

  app.post("/api/orders", async (req: Request, res: Response) => {
    const { productId, buyerEmail, buyerName, paid = false } = req.body;

    if (!productId || !buyerEmail) {
      return res
        .status(400)
        .send({ message: "productId and buyerEmail are required" });
    }

    if (!ObjectId.isValid(productId)) {
      return res.status(400).send({ message: "Invalid product id" });
    }

    const product = await productsCollection.findOne({
      _id: new ObjectId(productId),
    });

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const order = {
      productId,
      productTitle: product.title,
      price: product.price,
      buyerEmail,
      buyerName: buyerName || "",
      sellerEmail: product.createdBy || product.ownerEmail || "",
      status: "pending",
      paid,
      createdAt: new Date(),
    };

    const result = await ordersCollection.insertOne(order);

    res.status(201).send({ ...order, _id: result.insertedId });
  });

  app.patch(
    "/api/orders/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid order id" });
      }

      if (!status) {
        return res.status(400).send({ message: "Status is required" });
      }

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Order not found" });
      }

      res.send({ message: "Order status updated" });
    },
  );

  app.get("/api/orders", async (req: Request, res: Response) => {
    const { buyerEmail, sellerEmail } = req.query;

    let query = {};
    if (buyerEmail) query = { buyerEmail: buyerEmail as string };
    else if (sellerEmail) query = { sellerEmail: sellerEmail as string };

    const result = await ordersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  });

  app.get("/api/orders/received", async (req: Request, res: Response) => {
    const { sellerEmail } = req.query;

    if (!sellerEmail) {
      return res.status(400).send({ message: "sellerEmail is required" });
    }

    const result = await ordersCollection
      .find({ sellerEmail: sellerEmail as string })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  });

  app.get("/api/users", async (req: Request, res: Response) => {
    const result = await usersCollection
      .find({ role: { $ne: "admin" } })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  });

  app.patch(
    "/api/users/:id/ban",
    requireAuth,
    async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const { banned } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid user id" });
      }

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { banned: !!banned } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({ message: banned ? "User banned" : "User unbanned" });
    },
  );

  app.delete(
    "/api/users/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid user id" });
      }

      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({ message: "User deleted" });
    },
  );

  app.patch(
    "/api/products/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      const id = req.params.id as string;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid product id" });
      }

      const updates = { ...req.body };
      delete updates._id;

      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Product not found" });
      }

      res.send({ message: "Product updated" });
    },
  );
}

run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "homepage" });
});

app.listen(PORT, () => {
  console.log("server is running.");
});
