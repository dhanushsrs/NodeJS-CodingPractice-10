const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Started')
    })
  } catch (e) {
    console.log(`DB ERROR: ${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

const convertStateDBObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDBObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

// api 1 post method:

app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const selectUserQuery = `
    SELECT * 
    FROM user
    WHERE username = '${username}'`

  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'SECRET TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Authentication with Token

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// api 2 get method:

app.get('/states/', authenticateToken, async (request, response) => {
  const getStateQuery = `
      SELECT *
      FROM state`

  const stateQuery = await db.all(getStateQuery)
  response.send(
    stateQuery.map(eachState => {
      return convertStateDBObjectToResponseObject(eachState)
    }),
  )
})

// api 3 get method:
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params

  const getStateQuery = `
      SELECT *
      FROM state
      WHERE state_id = ${stateId}`

  const stateQuery = await db.get(getStateQuery)
  response.send(convertStateDBObjectToResponseObject(stateQuery))
})

// API 4 POST METHOD:
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const addDistrictQuery = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`

  const addDistrict = await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})

// API 5 GET METHOD;

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params

    const getDistrictQuery = `
      SELECT *
      FROM district
      WHERE district_id = ${districtId}`

    const districtQuery = await db.get(getDistrictQuery)
    response.send(convertDistrictDBObjectToResponseObject(districtQuery))
  },
)

// API 6 DELETE METHOD;
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params

    const deleteDistrictQuery = `
  DELETE FROM district
  WHERE district_id = ${districtId}`

    const deleteDistrict = await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

// API 7 PUT METHOD;
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateDistrictQuery = `
  UPDATE  district 
  SET 
  district_name = '${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE district_id = ${districtId}`

    const updateDistrict = await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// API 8 GET METHOD;

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params

    const getStatsQuery = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM district
  WHERE state_id = ${stateId}`

    const statsQuery = await db.get(getStatsQuery)

    response.send({
      totalCases: statsQuery['SUM(cases)'],
      totalCured: statsQuery['SUM(cured)'],
      totalActive: statsQuery['SUM(active)'],
      totalDeaths: statsQuery['SUM(deaths)'],
    })
  },
)

module.exports = app
