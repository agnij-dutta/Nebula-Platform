'use client';

import React, { useState } from 'react';
import styled from 'styled-components';

const IPListings: React.FC = () => {
  const [listings, setListings] = useState([
    { id: '1', title: 'Nebula Research Algorithm', price: '2500', image: '/placeholder-1.jpg', type: 'Full Ownership' },
    { id: '2', title: 'Quantum Computing Protocol', price: '3750', image: '/placeholder-2.jpg', type: 'License' },
    { id: '3', title: 'Neural Network Architecture', price: '1800', image: '/placeholder-3.jpg', type: 'Full Ownership' },
    { id: '4', title: 'Astronomical Data Analysis Tool', price: '2100', image: '/placeholder-4.jpg', type: 'License' },
  ]);

  return (
    <ListingsContainer>
      <SectionHeader>
        <h1>Intellectual Property Marketplace</h1>
        <SubHeader>Discover and acquire revolutionary intellectual property</SubHeader>
      </SectionHeader>
      
      <FiltersRow>
        <FilterGroup>
          <label>Type:</label>
          <select>
            <option value="all">All Types</option>
            <option value="full">Full Ownership</option>
            <option value="license">License</option>
          </select>
        </FilterGroup>
        
        <FilterGroup>
          <label>Sort By:</label>
          <select>
            <option value="recent">Recently Added</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </FilterGroup>
        
        <SearchBox>
          <input type="text" placeholder="Search listings..." />
          <SearchButton>Search</SearchButton>
        </SearchBox>
      </FiltersRow>
      
      <ListingsGrid>
        {listings.map(listing => (
          <ListingCard key={listing.id}>
            <ImagePlaceholder />
            <CardContent>
              <ListingTitle>{listing.title}</ListingTitle>
              <ListingType>{listing.type}</ListingType>
              <ListingPrice>{listing.price} AVAX</ListingPrice>
              <ButtonsRow>
                <ViewButton>View Details</ViewButton>
                <PurchaseButton>Purchase</PurchaseButton>
              </ButtonsRow>
            </CardContent>
          </ListingCard>
        ))}
      </ListingsGrid>
      
      <EmptyState>
        <p>More listings coming soon!</p>
        <CreateButton>Create IP Listing</CreateButton>
      </EmptyState>
    </ListingsContainer>
  );
};

// Styled Components
const ListingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const SectionHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  
  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    background: linear-gradient(45deg, var(--primary), var(--secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

const SubHeader = styled.p`
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.8);
  max-width: 600px;
  margin: 0 auto;
`;

const FiltersRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(30, 31, 46, 0.5);
  border-radius: var(--border-radius-md);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(139, 92, 246, 0.2);
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  label {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
  }
  
  select {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(139, 92, 246, 0.2);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    
    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
`;

const SearchBox = styled.div`
  display: flex;
  flex: 1;
  max-width: 400px;
  
  input {
    flex: 1;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-right: none;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius-sm) 0 0 var(--border-radius-sm);
    
    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
`;

const SearchButton = styled.button`
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0 var(--border-radius-sm) var(--border-radius-sm) 0;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: linear-gradient(45deg, var(--primary-dark), var(--primary));
  }
`;

const ListingsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
`;

const ListingCard = styled.div`
  background: rgba(30, 31, 46, 0.7);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  border: 1px solid rgba(139, 92, 246, 0.2);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 
      0 15px 35px rgba(0, 0, 0, 0.3),
      0 0 30px rgba(139, 92, 246, 0.2);
  }
`;

const ImagePlaceholder = styled.div`
  height: 180px;
  background: linear-gradient(45deg, #2c3e50, #4a5568);
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background: 
      linear-gradient(45deg, rgba(139, 92, 246, 0.2) 0%, transparent 70%),
      radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.3) 0%, transparent 60%);
  }
`;

const CardContent = styled.div`
  padding: 1.5rem;
`;

const ListingTitle = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: white;
`;

const ListingType = styled.div`
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--primary-light);
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
`;

const ListingPrice = styled.div`
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: white;
  font-family: 'Space Grotesk', monospace;
`;

const ButtonsRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ViewButton = styled.button`
  flex: 1;
  background: rgba(30, 31, 46, 0.5);
  color: white;
  border: 1px solid rgba(139, 92, 246, 0.4);
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(139, 92, 246, 0.1);
  }
`;

const PurchaseButton = styled.button`
  flex: 1;
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: linear-gradient(45deg, var(--primary-dark), var(--primary));
  }
`;

const EmptyState = styled.div`
  text-align: center;
  margin-top: 2rem;
  padding: 3rem;
  background: rgba(30, 31, 46, 0.5);
  border-radius: var(--border-radius-lg);
  border: 1px dashed rgba(139, 92, 246, 0.3);
  
  p {
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 1rem;
  }
`;

const CreateButton = styled.button`
  background: linear-gradient(45deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 7px 14px rgba(0, 0, 0, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
  }
`;

export default IPListings; 