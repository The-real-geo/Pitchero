// pitchero/src/components/LoginPage.js
import React, { useState, useEffect } from "react";
import { auth, db } from "../utils/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, collection, getDocs, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  // Club-related state for signup
  const [clubName, setClubName] = useState("");
  const [existingClubs, setExistingClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [isNewClub, setIsNewClub] = useState(true);
  
  // Load existing clubs for selection
  useEffect(() => {
    const loadClubs = async () => {
      try {
        const clubsSnapshot = await getDocs(collection(db, 'clubs'));
        const clubs = clubsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setExistingClubs(clubs);
      } catch (err) {
        console.error("Error loading clubs:", err);
      }
    };
    
    if (!isLogin) {
      loadClubs();
    }
  }, [isLogin]);

  const createClub = async (clubName) => {
    const clubRef = doc(collection(db, 'clubs'));
    await setDoc(clubRef, {
      name: clubName,
      subscription: 'active',
      createdAt: Date.now()
    });
    return clubRef.id;
  };

  const createUserProfile = async (userId, email, clubId) => {
    await setDoc(doc(db, 'users', userId), {
      email: email,
      clubId: clubId,
      role: 'admin', // First user of club is admin
      createdAt: Date.now()
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        // Log in existing user
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Sign up new user
        if (!isNewClub && !selectedClubId) {
          setError("Please select a club");
          return;
        }
        if (isNewClub && !clubName.trim()) {
          setError("Please enter a club name");
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create or use existing club
        let clubId;
        if (isNewClub) {
          clubId = await createClub(clubName.trim());
        } else {
          clubId = selectedClubId;
        }
        
        // Create user profile
        await createUserProfile(userCredential.user.uid, email, clubId);
      }
      navigate("/menu");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ 
      padding: "40px", 
      maxWidth: "450px", 
      margin: "0 auto", 
      fontFamily: "system-ui, sans-serif",
      backgroundColor: "white",
      borderRadius: "12px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      marginTop: "40px"
    }}>
      <h1 style={{ textAlign: "center", marginBottom: "24px", color: "#1f2937" }}>
        {isLogin ? "Login" : "Sign Up"}
      </h1>
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ 
            padding: "12px", 
            fontSize: "16px", 
            border: "1px solid #d1d5db",
            borderRadius: "6px"
          }}
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ 
            padding: "12px", 
            fontSize: "16px",
            border: "1px solid #d1d5db",
            borderRadius: "6px"
          }}
        />

        {/* Club selection for signup */}
        {!isLogin && (
          <div style={{ 
            border: "1px solid #e5e7eb", 
            borderRadius: "8px", 
            padding: "16px",
            backgroundColor: "#f9fafb"
          }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#374151" }}>
              Club Information
            </h3>
            
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="radio"
                  name="clubOption"
                  checked={isNewClub}
                  onChange={() => setIsNewClub(true)}
                />
                <span style={{ fontSize: "14px" }}>Create new club</span>
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="radio"
                  name="clubOption"
                  checked={!isNewClub}
                  onChange={() => setIsNewClub(false)}
                  disabled={existingClubs.length === 0}
                />
                <span style={{ fontSize: "14px", color: existingClubs.length === 0 ? "#9ca3af" : "#374151" }}>
                  Join existing club {existingClubs.length === 0 && "(none available)"}
                </span>
              </label>
            </div>

            {isNewClub ? (
              <input
                type="text"
                placeholder="Enter club name (e.g., Manchester United FC)"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                required
                style={{ 
                  width: "100%",
                  padding: "8px", 
                  fontSize: "14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  boxSizing: "border-box"
                }}
              />
            ) : (
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                required={!isNewClub}
                disabled={existingClubs.length === 0}
                style={{ 
                  width: "100%",
                  padding: "8px", 
                  fontSize: "14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "white"
                }}
              >
                <option value="">Select a club...</option>
                {existingClubs.map(club => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        
        <button 
          type="submit" 
          style={{ 
            padding: "12px", 
            fontSize: "16px", 
            cursor: "pointer",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600"
          }}
        >
          {isLogin ? "Login" : "Sign Up"}
        </button>
        
        {error && (
          <div style={{ 
            color: "#dc2626", 
            fontSize: "14px",
            padding: "8px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "4px"
          }}>
            {error}
          </div>
        )}
      </form>
      
      <p style={{ textAlign: "center", marginTop: "16px", fontSize: "14px", color: "#6b7280" }}>
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
            setClubName("");
            setSelectedClubId("");
          }}
          style={{ 
            background: "none", 
            border: "none", 
            color: "#3b82f6", 
            cursor: "pointer", 
            textDecoration: "underline",
            fontSize: "14px"
          }}
        >
          {isLogin ? "Sign Up" : "Login"}
        </button>
      </p>
    </div>
  );
}

export default LoginPage;