// pitchero/src/components/LoginPage.js
import React, { useState } from "react";
import { auth, db } from "../utils/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import logo from "../assets/images/logo.PNG";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  // Club-related state for signup
  const [clubName, setClubName] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [isNewClub, setIsNewClub] = useState(true);

const createClub = async (clubName) => {
  try {
    // Generate a 6-character club ID
    const clubId = Math.random().toString(36).substr(2, 6).toUpperCase();
    
    console.log('Creating club:', { clubName, clubId });
    await setDoc(doc(db, 'clubs', clubId), {
      name: clubName,
      subscription: 'active',
      createdAt: Date.now(),
      clubId: clubId
    });
    
    console.log(`✅ Club created: ${clubName} (ID: ${clubId})`);
    return clubId;
  } catch (error) {
    console.error('❌ Error creating club:', error);
    throw error;
  }
};

const createUserProfile = async (userId, email, clubId, role = 'member') => {
  try {
    console.log('Creating user profile:', { userId, email, clubId, role });
    await setDoc(doc(db, 'users', userId), {
      email: email,
      clubId: clubId,
      role: role,
      createdAt: Date.now()
    });
    console.log('✅ User profile created successfully');
  } catch (error) {
    console.error('❌ Error creating user profile:', error);
    throw error; // Re-throw so the parent function knows it failed
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    console.log('🚀 handleSubmit called', { isLogin, email, isNewClub, clubName, selectedClubId });

    try {
      if (isLogin) {
        console.log('🔐 Attempting login...');
        // Log in existing user
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        console.log('📝 Starting signup process...');
        // Sign up new user
        if (!isNewClub && !selectedClubId.trim()) {
          setError("Please enter a club ID");
          return;
        }
        if (!isNewClub && selectedClubId.trim().length !== 6) {
          setError("Club ID must be exactly 6 characters");
          return;
        }
        if (isNewClub && !clubName.trim()) {
          setError("Please enter a club name");
          return;
        }

        // If joining existing club, validate it exists BEFORE creating auth account
        let clubId;
        if (!isNewClub) {
          console.log('🔍 Validating existing club BEFORE auth...');
          try {
            const clubDoc = await getDoc(doc(db, 'clubs', selectedClubId.trim().toUpperCase()));
            if (!clubDoc.exists()) {
              setError("Invalid club ID. Please check with your club administrator.");
              return;
            }
            clubId = selectedClubId.trim().toUpperCase();
            console.log('✅ Club validated:', clubId);
          } catch (clubError) {
            console.error('❌ Error validating club (trying without auth):', clubError);
            setError("Unable to validate club ID. Please check your internet connection and try again.");
            return;
          }
        }

        console.log('✅ Validation passed, creating auth account...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Auth account created:', userCredential.user.uid);
        
        // Create club if needed (only for new clubs)
        if (isNewClub) {
          console.log('🏢 Creating new club...');
          clubId = await createClub(clubName.trim());
        }
        
        // Create user profile
        console.log('👤 Creating user profile...');
        const role = isNewClub ? 'admin' : 'member';
        await createUserProfile(userCredential.user.uid, email, clubId, role);
        console.log('✅ User profile should be created');
      }
      console.log('✅ Success! Navigating to menu...');
      navigate("/menu");
    } catch (err) {
      console.error('❌ Error in handleSubmit:', err);
      setError(err.message);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#243665",
      overflow: "auto"
    }}>
      {/* Logo section - centered above the login box */}
      <div style={{ 
        marginBottom: "32px" 
      }}>
        <img 
          src={logo} 
          alt="PitcHero" 
          style={{ 
            height: "360px", 
            width: "auto" 
          }}
        />
      </div>
      
      <div style={{ 
        padding: "40px", 
        maxWidth: "450px", 
        width: "90%",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
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
                  />
                  <span style={{ fontSize: "14px" }}>Join existing club (requires club ID)</span>
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
                <div>
                  <input
                    type="text"
                    placeholder="Enter 6-character club ID (e.g., ABC123)"
                    value={selectedClubId}
                    onChange={(e) => setSelectedClubId(e.target.value.toUpperCase())}
                    required={!isNewClub}
                    maxLength="6"
                    style={{ 
                      width: "100%",
                      padding: "8px", 
                      fontSize: "14px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      backgroundColor: "white",
                      fontFamily: "monospace",
                      letterSpacing: "1px",
                      boxSizing: "border-box"
                    }}
                  />
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    Get this 6-character ID from your club administrator
                  </div>
                </div>
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
    </div>
  );
}

export default LoginPage;