import "dotenv/config";
import express, { Request, Response } from "express";
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

async function run() {
  await client.connect();
  const database = client.db("petpulse");
  const productsCollection = database.collection("products");
  const ordersCollection = database.collection("orders");

  app.post("/api/products", async (req: Request, res: Response) => {
    const newItem = req.body;
    const result = await productsCollection.insertOne({
      ...newItem,
      createdAt: new Date(),
    });
    res.send(result);
  });

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

  app.delete("/api/products/:id", async (req: Request, res: Response) => {
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
  });

  app.post("/api/orders", async (req: Request, res: Response) => {
    const { productId, buyerEmail, buyerName } = req.body;

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
      createdAt: new Date(),
    };

    const result = await ordersCollection.insertOne(order);

    res.status(201).send({ ...order, _id: result.insertedId });
  });

  app.patch("/api/orders/:id", async (req: Request, res: Response) => {
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
  });

  app.get("/api/orders", async (req: Request, res: Response) => {
    const { buyerEmail } = req.query;

    const query = buyerEmail ? { buyerEmail: buyerEmail as string } : {};
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
}

run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "homepage" });
});

app.listen(PORT, () => {
  console.log("server is running.");
});
