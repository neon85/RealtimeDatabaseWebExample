import { 
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from "./firebase";
import {
    User,
    UserCredential,
} from "@firebase/auth";
import { FirebaseError } from 'firebase/app';


console.log("login.js is Running");

const errorMessageElement = document.getElementById('errorMessage') as HTMLDivElement;
const successMessageElement = document.getElementById('successMessage') as HTMLDivElement;

window.addEventListener("load", function() {
    const loginForm = document.getElementById('loginForm') as HTMLFormElement;
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        const formData = new FormData(loginForm);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        console.log(`login with password: ${password}, email: ${email}`);

        try {
            // Create a new user with email and password
            const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
            const user: User = userCredential.user;

            console.log('Login successful:', user);
            errorMessageElement.textContent = ''; // Clear any previous errors
            successMessageElement.style.display = 'block';
            loginForm.reset(); // Clear the form
            window.location.href = '/';
        } catch (error: unknown) {
            console.error('Error login:', error);
            successMessageElement.style.display = 'none'; // Hide success message
            if (error instanceof FirebaseError) {
                errorMessageElement.textContent = getErrorMessage(error.code);
            } else {
                errorMessageElement.textContent = 'Unexpected problem occurred.';
            }
        }
    });
});

// Function to get a user-friendly error message based on the error code
function getErrorMessage(errorCode: string) {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'User not found. Please check your email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/invalid-email':
            return 'The email address is invalid.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        default:
            return 'An error occurred during login.';
    }
}