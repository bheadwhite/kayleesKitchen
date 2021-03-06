import * as firebase from "firebase/app"
import "firebase/firestore"
import "firebase/auth"
import "firebase/storage"
import "firebase/analytics"

const config = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_DATABASE_URL,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
}
firebase.initializeApp(config)
firebase.analytics()

const firestoreRef = firebase.firestore()
export const storageRef = firebase.storage()
export const authRef = firebase.auth()

export const userRef = firestoreRef.collection("users")
export const recipesRef = firestoreRef.collection("recipes")
