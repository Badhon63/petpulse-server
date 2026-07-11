require("dotenv").config();
const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 5000;
const app = express();

app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const database = client.db("petpulse");
    const usersCollection = database.collection("user");
    const productsCollection = database.collection("products");

    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/api/products", async (req, res) => {
      const newItem = req.body;
      const result = await productsCollection.insertOne({
        ...newItem,
        createdAt: new Date(),
      });
      res.send(result);
    });

    app.get("/api/products", async (req, res) => {
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });
  } finally {
    //
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send({ message: "homepage" });
});

app.listen(PORT, () => {
  console.log("server is running.");
});
