import React from 'react';
import IPManagementDashboard from '../components/IPManagement/IPManagementDashboard';
import styled from 'styled-components';

const Container = styled.div`
  width: 100%;
`;

const IPManagement: React.FC = () => {
  return (
    <Container>
      <IPManagementDashboard />
    </Container>
  );
};

export default IPManagement;
