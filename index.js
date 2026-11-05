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
console.log(process.env.MONGO_USER_URI);
console.log(process.env.MONGO_PASSWORD_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const dbClient = await connectToMongoDB();
const user = dbClient.db("assigment-8");
const users = user.collection("createEvent");
const MyEvents = user.collection("MyEvents");

//http://localhost:3000/createEvent

const varifyUser = async (req, res, next) => {
  const authorizer = req.headers.authorization;
  console.log(authorizer);
  const token = authorizer.split(" ")[1];
  console.log(token);
  if (!token) {
    return res.status(401).send({ msg: "unAthorizer" });
  }

  const jwks = createRemoteJWKSet(
    new URL(`${process.env.LOCAL_URL}/api/auth/jwks`),
  );

  try {
    const { payload } = await jwtVerify(token, jwks);
    console.log(payload)
    next();
  } catch (err) {
    return res.status(500).send({ msg: "Server Error!" });
  }
};

//all get data
app.get("/createEvent", async (req, res) => {
  const result = await users.find({}).sort({ eventDate: 1 }).toArray();
  res.send(result);
});

// search filter data
app.get("/event/search",varifyUser, async (req, res) => {
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
app.get("/myCreateEvent/:email",varifyUser, async (req, res) => {
  const { email } = req.params;
  const result = await users
    .find({ email: email })
    .sort({ eventDate: 1 })
    .toArray();
  res.send(result);
});

// join event data show
app.get("/joinEvent/:email",varifyUser, async (req, res) => {
  const { email } = req.params;
  const result = await MyEvents.find({ email: email })
    .sort({ eventDate: 1 })
    .toArray();
  res.send(result);
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
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await users.findOne(query);
  res.send(result);
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