const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://car-doctor-client-27c55.web.app'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const user = process.env.DB_USER
const password = process.env.DB_PASS

const uri = `mongodb+srv://${user}:${password}@cluster0.ahaugjj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middleware
const logger = async(req, res, next) => {
  //console.log( 'hostname', req.hostname , 'method', req.method ,'Url', req.originalUrl)
  next()
}

const verifyToken = async(req, res, next) => {
  const accessToken = req.cookies?.accessToken;
  //console.log("middleware token", accessToken)
  // token unavailable
  if (!accessToken) {
    return res.status(401).send({message: "Unauthorized"})
  }
  // token available
  jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    //console.log("verifyToken", accessToken)
    if(error){
      console.log(error)
      return res.status(401).send({message: "Invalid unauthorized"})
    }else{
      req.decodedToken = decoded;
      next();
    }
    
  })
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("carDoctorDB");
    const servicesCollection = database.collection("services");
    const checkOutCollection = database.collection('checkOuts');

    // auth related post
    app.post("/jwt", async(req, res) => {
      const userEmail = req.body;
      console.log(userEmail)//as a object
      const token = jwt.sign( userEmail, process.env.ACCESS_TOKEN_SECRET , 
        { expiresIn: '1h' });
      
      res
        .cookie('accessToken', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none'
        })
        .send({ loginSuccess : true })
    })

    app.post('/logout', async (req, res) => {
      const userEmail = req.body;
      console.log('logging out', userEmail);
      res
        .clearCookie('accessToken', { maxAge: 0 })
        .send({ logoutSuccess: true })
    })

    // services related api
    app.get("/services", logger, async(req, res) => {
      const cursor = servicesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    }) 

    app.get("/services/:id", async(req, res) => {
      const id = req.params.id;
      const query = { _id : new ObjectId(id)};
      
      const result = await servicesCollection.findOne(query);
      res.send(result);
    })

    //checkOut related api
    app.get("/checkOut", logger, verifyToken,  async(req, res) => {
      console.log("requestedData/userInfo", req.query);
      console.log('decodedToken/tokenOwnerInfo' ,req.decodedToken)
      if(req.query.email != req.decodedToken.email){
        return res.status(403).send({message : "forbidden"})
      }
      let query = {};
      if (req.query?.email) {
        query = {email :req.query.email};
       } 
      const result = await checkOutCollection.find(query).toArray();
      res.send(result);
    })

    app.get("/checkOut/:id", async(req, res) => {
      const id = req.params.id;
      const query = { _id : new ObjectId(id)};
      
      const result = await checkOutCollection.findOne(query);
      res.send(result);
    })

    app.post("/checkOut", async(req,res) => {
      const checkOut = req.body;
      //console.log(checkOut)

      const result = await checkOutCollection.insertOne(checkOut)
      res.send(result)
    })

    app.patch("/checkOut/:id", async(req, res) => {
      const id = req.params.id;
      const filter ={ _id : new ObjectId(id)}
      const updatedCheckOut = req.body;
      //console.log(updatedCheckOut)
      const updatedDoc = {
        $set:{
          status: updatedCheckOut.status
        }
      }
      const result =await checkOutCollection.updateOne(filter,updatedDoc)
      res.send(result)
    })

    app.delete('/checkOut/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await checkOutCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Car CURD Server is running")
})

app.listen(port, () => {
  console.log(`Car doctor CURD server is running in port ${port}`)
})