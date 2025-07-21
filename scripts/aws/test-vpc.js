#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Testing VPC configuration...\n'));

try {
    // Get VPC ID from Terraform outputs
    console.log(chalk.yellow('Getting VPC ID from Terraform outputs...'));
    const vpcId = execSync('cd Cloud/AWS/terraform && terraform output -raw vpc_id', {
        encoding: 'utf8',
    }).trim();
    console.log(chalk.green(`✅ VPC ID: ${vpcId}`));

    // Describe VPC
    console.log(chalk.yellow('Describing VPC...'));
    const vpcInfo = execSync(`aws ec2 describe-vpcs --vpc-ids ${vpcId} --profile cliadmin`, {
        encoding: 'utf8',
    });
    const vpc = JSON.parse(vpcInfo).Vpcs[0];

    console.log(chalk.green('✅ VPC details:'));
    console.log(chalk.gray(`   CIDR Block: ${vpc.CidrBlock}`));
    console.log(chalk.gray(`   State: ${vpc.State}`));
    console.log(chalk.gray(`   Default VPC: ${vpc.IsDefault}`));

    // Get subnets
    console.log(chalk.yellow('Getting subnet information...'));
    const subnetsInfo = execSync(
        `aws ec2 describe-subnets --filters Name=vpc-id,Values=${vpcId} --profile cliadmin`,
        { encoding: 'utf8' }
    );
    const subnets = JSON.parse(subnetsInfo).Subnets;

    console.log(chalk.green(`✅ Found ${subnets.length} subnets:`));
    subnets.forEach((subnet, index) => {
        console.log(
            chalk.gray(
                `   ${index + 1}. ${subnet.SubnetId} (${subnet.CidrBlock}) - ${
                    subnet.AvailabilityZone
                }`
            )
        );
    });

    // Get route tables
    console.log(chalk.yellow('Getting route table information...'));
    const routeTablesInfo = execSync(
        `aws ec2 describe-route-tables --filters Name=vpc-id,Values=${vpcId} --profile cliadmin`,
        { encoding: 'utf8' }
    );
    const routeTables = JSON.parse(routeTablesInfo).RouteTables;

    console.log(chalk.green(`✅ Found ${routeTables.length} route tables:`));
    routeTables.forEach((rt, index) => {
        console.log(chalk.gray(`   ${index + 1}. ${rt.RouteTableId} (${rt.Routes.length} routes)`));
    });

    // Get security groups
    console.log(chalk.yellow('Getting security group information...'));
    const securityGroupsInfo = execSync(
        `aws ec2 describe-security-groups --filters Name=vpc-id,Values=${vpcId} --profile cliadmin`,
        { encoding: 'utf8' }
    );
    const securityGroups = JSON.parse(securityGroupsInfo).SecurityGroups;

    console.log(chalk.green(`✅ Found ${securityGroups.length} security groups:`));
    securityGroups.forEach((sg, index) => {
        console.log(chalk.gray(`   ${index + 1}. ${sg.GroupId} (${sg.GroupName})`));
    });

    // Get VPC endpoints
    console.log(chalk.yellow('Getting VPC endpoint information...'));
    const vpcEndpointsInfo = execSync(
        `aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values=${vpcId} --profile cliadmin`,
        { encoding: 'utf8' }
    );
    const vpcEndpoints = JSON.parse(vpcEndpointsInfo).VpcEndpoints;

    console.log(chalk.green(`✅ Found ${vpcEndpoints.length} VPC endpoints:`));
    vpcEndpoints.forEach((endpoint, index) => {
        console.log(
            chalk.gray(`   ${index + 1}. ${endpoint.VpcEndpointId} (${endpoint.ServiceName})`)
        );
    });

    console.log(chalk.green('\n🎉 VPC test completed successfully!'));
} catch (error) {
    console.error(chalk.red('❌ VPC test failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
}
