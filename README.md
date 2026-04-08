# 343-Prysmatik
The Smart Urban Mobility Management System (SUMMS) is a conceptual, integrated digital platform designed to coordinate and optimize multiple urban mobility services within a smart city environment. SUMMS aims to improve transportation efficiency, reduce congestion, and enhance the overall mobility experience for citizens by unifying shared mobility services, parking infrastructure, and public transportation into a single, intelligent management system.

## Team Members
 - Sasha Klein-Charland (40281076) - sasha-klnd
 - Omar Ghazaly (40280795) - HersheyWaffle
 - Katerina D’Ambrosio (40281139) - kdambrosio5
 - Shayan Javanmardi (40299147) - shayjaa
 - Yan Znaty (40284722) - yznaty
 - Kourosh Fadaei N. (40289423) - k0ur0sh10




## Running the code

Note : 
Open two terminals, one for the frontend, the other one for the backend.

FRONTEND: 

  Run `npm i` to install the dependencies. (Install npm if u don't have it)

  Run `npm run dev` to start the development server.
  
  If you want to see it on your phone (or all devices connected to the same network as ur laptop) : 
  run 'npm run dev -- --host


BACKEND : 

Install all dependencies : 
  pip install -r requirements.txt

Initalize db (if not done):
  flask --app run.py db init
  flask --app run.py db migrate -m "init"
  flask --app run.py db upgrade

Run python run.py 

