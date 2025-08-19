import { 
    createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from "./firebase";
import {
    User,
    UserCredential,
} from "@firebase/auth";
import { FirebaseError } from 'firebase/app';

const errorMessageElement = document.getElementById('errorMessage') as HTMLDivElement;
const successMessageElement = document.getElementById('successMessage') as HTMLDivElement;

console.log("signup.js is Running");

window.addEventListener("load", function() {
    const signupForm = document.getElementById('signupForm') as HTMLFormElement;
    if (!signupForm) {
        console.log("signForm not exist");
        return;
    }
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        const formData = new FormData(signupForm);
        const email: string = formData.get('email') as string;
        const password: string = formData.get('password') as string;
        console.log(`signing up with password: ${password}, email: ${email}`);

        try {
            // Create a new user with email and password
            const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user: User = userCredential.user;

            console.log('Sign up successful:', user);
            errorMessageElement.textContent = ''; // Clear any previous errors
            successMessageElement.style.display = 'block';
            signupForm.reset(); // Clear the form
            window.location.href = '/';
        } catch (error) {
            console.error('Error signing up:', error);
            successMessageElement.style.display = 'none'; // Hide success message
            if (error instanceof FirebaseError) {
                errorMessageElement.textContent = getErrorMessage(error.code);
            } else {
                errorMessageElement.textContent = 'Unexpected error occurred.';
            }
        }
    });
});

function getErrorMessage(errorCode: string) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email address is already in use.';
        case 'auth/invalid-email':
            return 'The email address is invalid.';
        case 'auth/weak-password':
            return 'The password is too weak. It should be at least 6 characters.';
        default:
            return 'An error occurred during sign up.';
    }
}