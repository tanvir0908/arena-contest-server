const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

// mongodb imports
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8snrbzq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // database collections
    const usersCollection = client.db("arenaContest").collection("users");
    const contestCollection = client.db("arenaContest").collection("contest");

    // get users information using email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    //get user role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      //   if (email !== req.decoded.email) {
      //     return res.status(403).send({ message: "forbidden access" });
      //   }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let role = false;
      if (user?.role === "admin") {
        role = "admin";
      } else if (user?.role === "moderator") {
        role = "moderator";
      } else {
        role = "user";
      }
      res.send({ role });
    });
    // store users information into database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already existed" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // contest collection
    // add new contest
    app.post("/contest", async (req, res) => {
      const newContest = req.body;
      const result = await contestCollection.insertOne(newContest);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ArenaContest server is running...");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
