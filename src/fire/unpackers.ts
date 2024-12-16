import { firestore } from "firebase";
import { Recipe } from "src/types/types";

export function unpackRecipes(
  firestoreData: firestore.QuerySnapshot<firestore.DocumentData>,
): Recipe[] {
  return firestoreData.docs
    .map((doc) => {
      const data = doc.data();
      if (data == null) {
        throw new Error("No data found in document");
      }

      return {
        id: doc.id,
        title: data.title,
      };
    })
    .sort((a, b) => {
      if (a.title.toLowerCase() > b.title.toLowerCase()) {
        return 1;
      } else {
        return -1;
      }
    });
}
