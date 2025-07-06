#!/usr/bin/env node

const { EC2Client, DescribeVpcsCommand, DescribeNatGatewaysCommand, DescribeNetworkInterfacesCommand, DeleteNatGatewayCommand, DeleteNetworkInterfaceCommand, DeleteVpcCommand, DescribeInternetGatewaysCommand, DetachInternetGatewayCommand, DeleteInternetGatewayCommand, DescribeRouteTablesCommand, DeleteRouteCommand, DeleteRouteTableCommand, DescribeSubnetsCommand, DeleteSubnetCommand, DescribeSecurityGroupsCommand, DeleteSecurityGroupCommand, DescribeNetworkAclsCommand, DeleteNetworkAclCommand, DescribeVpcEndpointsCommand, DeleteVpcEndpointCommand, DeleteVpcEndpointsCommand } = require('@aws-sdk/client-ec2');

const client = new EC2Client({ region: 'us-east-1' });

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const TARGET_VPC_IDS = ['vpc-0bbefd82febefcbe3']; // Only clean up this VPC

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function describeVpcs() {
  try {
    const command = new DescribeVpcsCommand({
      VpcIds: TARGET_VPC_IDS
    });
    const response = await client.send(command);
    return response.Vpcs;
  } catch (error) {
    log(`Error describing VPCs: ${error.message}`, 'red');
    return [];
  }
}

async function describeNatGateways(vpcId) {
  try {
    const command = new DescribeNatGatewaysCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.NatGateways;
  } catch (error) {
    log(`Error describing NAT gateways for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeNetworkInterfaces(vpcId) {
  try {
    const command = new DescribeNetworkInterfacesCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.NetworkInterfaces;
  } catch (error) {
    log(`Error describing network interfaces for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeInternetGateways(vpcId) {
  try {
    const command = new DescribeInternetGatewaysCommand({
      Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.InternetGateways;
  } catch (error) {
    log(`Error describing internet gateways for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeRouteTables(vpcId) {
  try {
    const command = new DescribeRouteTablesCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.RouteTables;
  } catch (error) {
    log(`Error describing route tables for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeSubnets(vpcId) {
  try {
    const command = new DescribeSubnetsCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.Subnets;
  } catch (error) {
    log(`Error describing subnets for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeSecurityGroups(vpcId) {
  try {
    const command = new DescribeSecurityGroupsCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.SecurityGroups;
  } catch (error) {
    log(`Error describing security groups for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeNetworkAcls(vpcId) {
  try {
    const command = new DescribeNetworkAclsCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.NetworkAcls;
  } catch (error) {
    log(`Error describing network ACLs for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function describeVpcEndpoints(vpcId) {
  try {
    const command = new DescribeVpcEndpointsCommand({
      Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
    });
    const response = await client.send(command);
    return response.VpcEndpoints;
  } catch (error) {
    log(`Error describing VPC endpoints for VPC ${vpcId}: ${error.message}`, 'red');
    return [];
  }
}

async function deleteNatGateway(natGatewayId) {
  try {
    log(`Deleting NAT Gateway: ${natGatewayId}`, 'yellow');
    const command = new DeleteNatGatewayCommand({ NatGatewayId: natGatewayId });
    await client.send(command);
    log(`✅ Deleted NAT Gateway: ${natGatewayId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting NAT Gateway ${natGatewayId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteNetworkInterface(eniId) {
  try {
    log(`Deleting Network Interface: ${eniId}`, 'yellow');
    const command = new DeleteNetworkInterfaceCommand({ NetworkInterfaceId: eniId });
    await client.send(command);
    log(`✅ Deleted Network Interface: ${eniId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting Network Interface ${eniId}: ${error.message}`, 'red');
    return false;
  }
}

async function detachInternetGateway(igwId, vpcId) {
  try {
    log(`Detaching Internet Gateway: ${igwId} from VPC: ${vpcId}`, 'yellow');
    const command = new DetachInternetGatewayCommand({
      InternetGatewayId: igwId,
      VpcId: vpcId
    });
    await client.send(command);
    log(`✅ Detached Internet Gateway: ${igwId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error detaching Internet Gateway ${igwId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteInternetGateway(igwId) {
  try {
    log(`Deleting Internet Gateway: ${igwId}`, 'yellow');
    const command = new DeleteInternetGatewayCommand({ InternetGatewayId: igwId });
    await client.send(command);
    log(`✅ Deleted Internet Gateway: ${igwId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting Internet Gateway ${igwId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteRoute(routeTableId, destinationCidrBlock) {
  try {
    log(`Deleting route ${destinationCidrBlock} from route table: ${routeTableId}`, 'yellow');
    const command = new DeleteRouteCommand({
      RouteTableId: routeTableId,
      DestinationCidrBlock: destinationCidrBlock
    });
    await client.send(command);
    log(`✅ Deleted route ${destinationCidrBlock}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting route ${destinationCidrBlock}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteRouteTable(routeTableId) {
  try {
    log(`Deleting Route Table: ${routeTableId}`, 'yellow');
    const command = new DeleteRouteTableCommand({ RouteTableId: routeTableId });
    await client.send(command);
    log(`✅ Deleted Route Table: ${routeTableId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting Route Table ${routeTableId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteSubnet(subnetId) {
  try {
    log(`Deleting Subnet: ${subnetId}`, 'yellow');
    const command = new DeleteSubnetCommand({ SubnetId: subnetId });
    await client.send(command);
    log(`✅ Deleted Subnet: ${subnetId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting Subnet ${subnetId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteSecurityGroup(sgId) {
  try {
    log(`Deleting Security Group: ${sgId}`, 'yellow');
    const command = new DeleteSecurityGroupCommand({ GroupId: sgId });
    await client.send(command);
    log(`✅ Deleted Security Group: ${sgId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting Security Group ${sgId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteNetworkAcl(naclId) {
  try {
    log(`Deleting Network ACL: ${naclId}`, 'yellow');
    const command = new DeleteNetworkAclCommand({ NetworkAclId: naclId });
    await client.send(command);
    log(`✅ Deleted Network ACL: ${naclId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting Network ACL ${naclId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteVpcEndpoint(endpointId) {
  try {
    log(`Deleting VPC Endpoint: ${endpointId}`, 'yellow');
    const command = new DeleteVpcEndpointsCommand({ VpcEndpointIds: [endpointId] });
    await client.send(command);
    log(`✅ Deleted VPC Endpoint: ${endpointId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting VPC Endpoint ${endpointId}: ${error.message}`, 'red');
    return false;
  }
}

async function deleteVpc(vpcId) {
  try {
    log(`Deleting VPC: ${vpcId}`, 'yellow');
    const command = new DeleteVpcCommand({ VpcId: vpcId });
    await client.send(command);
    log(`✅ Deleted VPC: ${vpcId}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error deleting VPC ${vpcId}: ${error.message}`, 'red');
    return false;
  }
}

async function cleanupVpc(vpcId, vpcName) {
  log(`\n🔧 Cleaning up VPC: ${vpcId} (${vpcName})`, 'cyan');
  
  // 1. Delete VPC Endpoints
  const vpcEndpoints = await describeVpcEndpoints(vpcId);
  for (const endpoint of vpcEndpoints) {
    await deleteVpcEndpoint(endpoint.VpcEndpointId);
  }
  
  // 2. Delete NAT Gateways
  const natGateways = await describeNatGateways(vpcId);
  for (const natGateway of natGateways) {
    await deleteNatGateway(natGateway.NatGatewayId);
  }
  
  // 3. Delete Network Interfaces
  const networkInterfaces = await describeNetworkInterfaces(vpcId);
  for (const eni of networkInterfaces) {
    await deleteNetworkInterface(eni.NetworkInterfaceId);
  }
  
  // 4. Detach and Delete Internet Gateways
  const internetGateways = await describeInternetGateways(vpcId);
  for (const igw of internetGateways) {
    await detachInternetGateway(igw.InternetGatewayId, vpcId);
    await deleteInternetGateway(igw.InternetGatewayId);
  }
  
  // 5. Delete Routes and Route Tables
  const routeTables = await describeRouteTables(vpcId);
  for (const routeTable of routeTables) {
    // Skip the main route table as it gets deleted with the VPC
    if (!routeTable.Associations.some(assoc => assoc.Main)) {
      // Delete non-main routes first
      for (const route of routeTable.Routes) {
        if (route.DestinationCidrBlock && route.DestinationCidrBlock !== '0.0.0.0/0') {
          await deleteRoute(routeTable.RouteTableId, route.DestinationCidrBlock);
        }
      }
      await deleteRouteTable(routeTable.RouteTableId);
    }
  }
  
  // 6. Delete Subnets
  const subnets = await describeSubnets(vpcId);
  for (const subnet of subnets) {
    await deleteSubnet(subnet.SubnetId);
  }
  
  // 7. Delete Security Groups (skip default)
  const securityGroups = await describeSecurityGroups(vpcId);
  for (const sg of securityGroups) {
    if (sg.GroupName !== 'default') {
      await deleteSecurityGroup(sg.GroupId);
    }
  }
  
  // 8. Delete Network ACLs (skip default)
  const networkAcls = await describeNetworkAcls(vpcId);
  for (const nacl of networkAcls) {
    if (!nacl.IsDefault) {
      await deleteNetworkAcl(nacl.NetworkAclId);
    }
  }
  
  // 9. Finally, delete the VPC
  await deleteVpc(vpcId);
  
  log(`✅ Completed cleanup of VPC: ${vpcId}`, 'green');
}

async function main() {
  log('🧹 Starting VPC cleanup process...', 'blue');
  
  const vpcs = await describeVpcs();
  
  if (vpcs.length === 0) {
    log('✅ No Chatterbox VPCs found to clean up', 'green');
    return;
  }
  
  log(`Found ${vpcs.length} VPC(s) to clean up:`, 'yellow');
  for (const vpc of vpcs) {
    const name = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
    log(`  - ${vpc.VpcId} (${name}) - ${vpc.CidrBlock}`, 'yellow');
  }
  
  log('\n⚠️  This will delete ALL VPC resources including:', 'red');
  log('   - NAT Gateways', 'red');
  log('   - Network Interfaces', 'red');
  log('   - Internet Gateways', 'red');
  log('   - Route Tables', 'red');
  log('   - Subnets', 'red');
  log('   - Security Groups', 'red');
  log('   - Network ACLs', 'red');
  log('   - VPC Endpoints', 'red');
  log('   - The VPC itself', 'red');
  
  // For automation, proceed without confirmation
  log('\n🚀 Proceeding with cleanup...', 'blue');
  
  for (const vpc of vpcs) {
    const name = vpc.Tags?.find(tag => tag.Key === 'Name')?.Value || 'No Name';
    await cleanupVpc(vpc.VpcId, name);
  }
  
  log('\n🎉 VPC cleanup completed!', 'green');
}

main().catch(error => {
  log(`❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
}); 