const express = require("express");
const app = express();
const cors = require("cors");
const stripe = require("stripe")(
  "sk_test_51OEtWTJ5bzp9GZmmp0OyYzJpEnveKmUVOE3RTp8mtuKBk44bzUwvCs9MQzPEnnKoN9LHqbKZaOLkyE6ImnBkWtXZ005dc00cTd"
);
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
    const registerCollection = client.db("arenaContest").collection("register");

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "cad",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // users collection
    // get all users data
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
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
    // get best creators
    app.get("/bestCreators", async (req, res) => {
      const filter = { role: "moderator" };
      const options = {
        sort: { count: -1 },
      };
      const selectedModerators = await usersCollection
        .find(filter, options)
        .limit(4)
        .toArray();
      const moderatorsEmail = selectedModerators.map(
        (moderator) => moderator.email
      );
      const selectedContests = await contestCollection
        .find({ creatorEmail: { $in: moderatorsEmail } })
        .toArray();
      res.send({ selectedContests, moderatorsEmail, selectedModerators });
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
    // change user role
    app.patch("/users", async (req, res) => {
      const id = req.body.id;
      const role = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // contest collection
    // add new contest
    app.post("/contest", async (req, res) => {
      const newContest = req.body;
      const creatorEmail = req.body.creatorEmail;
      const creatorFilter = { email: creatorEmail };
      const creatorData = await usersCollection.findOne(creatorFilter);
      const newCount = Number(creatorData.count) + 1;
      const updateDoc = {
        $set: {
          count: newCount,
        },
      };
      const updateUser = await usersCollection.updateOne(
        creatorFilter,
        updateDoc
      );
      const result = await contestCollection.insertOne(newContest);
      res.send(result);
    });
    // get contest data using id
    app.get("/contest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });
    // get all contests
    app.get("/contest", async (req, res) => {
      const result = await contestCollection.find().toArray();
      res.send(result);
    });
    // get approved contests
    app.get("/approvedContests", async (req, res) => {
      const query = { status: "approved" };
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });
    // get approved contests by contest type
    app.get("/approvedContests/:type", async (req, res) => {
      const type = req.params.type;
      const query = { status: "approved" };
      const result = await contestCollection.find(query).toArray();
      const filterResult = result.filter(
        (contest) => contest.contestType === type
      );
      res.send(filterResult);
    });
    //get approved most popular contests
    app.get("/popularContests", async (req, res) => {
      const query = {};
      const options = {
        sort: { participationCount: -1 },
      };
      const result = await contestCollection
        .find(query, options)
        .limit(6)
        .toArray();
      res.send(result);
    });
    // get contests by email
    app.get("/contestByEmail", async (req, res) => {
      const email = req.query.email;
      const query = { creatorEmail: email };
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });
    // get winning contests by email
    app.get("/winningContest", async (req, res) => {
      const email = req.query.email;
      const query = { contestWinnerEmail: email };
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });
    // get registered contest by users email
    app.get("/registeredContest", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await registerCollection.find(query).toArray();
      res.send(result);
    });
    // store registered contest information
    app.post("/registeredContest", async (req, res) => {
      const newRegister = req.body;
      const id = req.body.contest_Id;
      const result = await registerCollection.insertOne(newRegister);
      res.send(result);
    });

    // participation to the contest and store it into database
    app.patch("/registeredContest", async (req, res) => {
      // register collection status update
      const id = req.body.id;
      const registerFilter = { _id: new ObjectId(id) };
      const updateDocRegister = {
        $set: {
          status: "participated",
        },
      };
      const updateRegister = await registerCollection.updateOne(
        registerFilter,
        updateDocRegister
      );
      // contest collection participate number update
      const contestId = req.body.contestId;
      const contestFilter = { _id: new ObjectId(contestId) };
      const contestData = await contestCollection.findOne(contestFilter);
      const newCount = Number(contestData.participationCount) + 1;
      const updateDocContest = {
        $set: {
          participationCount: newCount,
        },
      };
      const updateContest = await contestCollection.updateOne(
        contestFilter,
        updateDocContest
      );
      console.log(updateContest, updateRegister);
      res.send(updateRegister);
    });

    // approve contest from admin
    app.patch("/contest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await contestCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // delete contest
    app.delete("/contest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.deleteOne(query);
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
