import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
app.use(express.json());
app.use(cors());
const port = 9000;

const client = new MongoClient(
  `mongodb://${process.env.MONGO_USER_URI}:${process.env.MONGO_PASSWORD_URI}@ac-myrwp58-shard-00-00.qzhspai.mongodb.net:27017,ac-myrwp58-shard-00-01.qzhspai.mongodb.net:27017,ac-myrwp58-shard-00-02.qzhspai.mongodb.net:27017/?ssl=true&replicaSet=atlas-xhguby-shard-0&authSource=admin`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
}

const dbClient = await connectToMongoDB();
const user = dbClient.db("assigment-8");
const users = user.collection("createEvent");
const MyEvents = user.collection("MyEvents");

//http://localhost:3000/createEvent

// Better Auth JWKS
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.LOCAL_URL}/api/auth/jwks`),
);

const varifyUser = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    // Authorization header আছে কি না
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).send({
        success: false,
        message: "Authorization token is missing!",
      });
    }

    // Bearer token আলাদা করা
    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).send({
        success: false,
        message: "Token is missing!",
      });
    }

    // Token verify
    const { payload } = await jwtVerify(token, JWKS);

    // পরবর্তী route-এ user information পাওয়া যাবে
    req.user = payload;

    next();
  } catch (error) {
    // আসল error শুধু backend terminal-এ দেখাবে
    console.error("Authentication Error:", error);

    return res.status(401).send({
      success: false,
      message: "Invalid or expired token!",
    });
  }
};


//all get data
app.get("/createEvent", async (req, res) => {
  const result = await users.find({}).sort({ eventDate: 1 }).toArray();
  res.send(result);
});

// search filter data
app.get("/event/search", async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category && category !== "All") {
      query.plantCategory = category;
    }
    const result = await users.find(query).sort({ eventDate: 1 }).toArray();
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

//home page 6 data show data
app.get("/getData-6", async (req, res) => {
  const result = await users.find({}).limit(6).sort({ eventDate: 1 }).toArray();
  res.send(result);
});

// my event  data
app.get("/myCreateEvent/:email",  async (req, res) => {
  try {
    const { email } = req.params;

    const result = await users
      .find({ email })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error("My Created Events Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch created events",
    });
  }
});
// join event data show
app.get("/joinEvent/:email", varifyUser, async (req, res) => {
  try {
    const { email } = req.params;

    const result = await MyEvents
      .find({ email })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error("Joined Events Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch joined events",
    });
  }
});
// join event data
app.post("/joinEvents",varifyUser, async (req, res) => {
  try {
    const { _id, email } = req.body;

    if (!_id || !email) {
      return res
        .status(400)
        .send({ success: false, message: "ID or Email is missing!" });
    }

    const alreadyJoined = await MyEvents.findOne({
      eventId: _id,
      email: email,
    });

    if (alreadyJoined) {
      return res.status(400).send({
        success: false,
        message: "আপনি ইতিমধ্যে এই ইভেন্টে জয়েন করেছেন!",
      });
    }

    const updateResult = await users.updateOne(
      { _id: new ObjectId(_id) },
      { $inc: { joinedTrees: 1 } },
    );

    const { _id: eventId, ...restData } = req.body;
    const joinData = { eventId, email, ...restData };

    const joinResult = await MyEvents.insertOne(joinData);

    res.send({ success: true, updateResult, joinResult, acknowledged: true });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// single page data
app.get("/single-id/:id", varifyUser, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID",
      });
    }

    const result = await users.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({
        success: false,
        message: "Event not found",
      });
    }

    res.status(200).send(result);
  } catch (error) {
    console.error("Single Event Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch event",
    });
  }
});
// create event data
app.post("/createEvent",varifyUser, async (req, res) => {
  const data = req.body;
  const result = await users.insertOne(data);

  res.send(result);
});

// update event data
app.patch("/update/:id",varifyUser, async (req, res) => {
  const id = req.params.id;
  const updateuser = req.body;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updatedoc = {
    $set: updateuser,
  };
  const result = await users.updateOne(filter, updatedoc, options);
  res.send(result);
  console.log(req.body);
});

// delete event data
app.delete("/deleteEvent/:id",varifyUser, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await users.deleteOne(query);
  res.send(result);
});

// join event delete data
app.delete("/joineventDelete/:id",varifyUser, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await MyEvents.deleteOne(query);
  res.send(result);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


export default app;