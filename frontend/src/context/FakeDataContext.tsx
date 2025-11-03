import React, { createContext, useContext, useState, useEffect } from "react";

interface FakeDataContextType {
  showFakeData: boolean;
  setShowFakeData: (show: boolean) => void;
}

const FakeDataContext = createContext<FakeDataContextType | undefined>(
  undefined,
);

export const useFakeData = () => {
  const context = useContext(FakeDataContext);
  if (context === undefined) {
    throw new Error("useFakeData must be used within a FakeDataProvider");
  }
  return context;
};

interface FakeDataProviderProps {
  children: React.ReactNode;
}

export const FakeDataProvider: React.FC<FakeDataProviderProps> = ({
  children,
}) => {
  const [showFakeData, setShowFakeData] = useState(true); // Default to showing fake data

  // Load setting from localStorage on mount
  useEffect(() => {
    const savedSetting = localStorage.getItem("showFakeData");
    if (savedSetting !== null) {
      setShowFakeData(JSON.parse(savedSetting));
    }
  }, []);

  // Save setting to localStorage when it changes
  const handleSetShowFakeData = (show: boolean) => {
    setShowFakeData(show);
    localStorage.setItem("showFakeData", JSON.stringify(show));
  };

  return (
    <FakeDataContext.Provider
      value={{ showFakeData, setShowFakeData: handleSetShowFakeData }}
    >
      {children}
    </FakeDataContext.Provider>
  );
};
