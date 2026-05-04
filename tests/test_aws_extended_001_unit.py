from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import modules.aws_extended_001 as aws001
from tests.helpers.aws_assertions import assert_common_fields as _assert_common_fields


TEST_CASES = [
    pytest.param(aws001.AWSEC2Service001, "eu-central-1", "123456789012", "ec2", "001", id="ec2-eu-central-1"),
    pytest.param(aws001.AWSS3Service002, "us-west-2", "210987654321", "s3", "002", id="s3-us-west-2"),
    pytest.param(aws001.AWSRDSService003, "ap-southeast-1", "555544443333", "rds", "003", id="rds-ap-southeast-1"),
    pytest.param(aws001.AWSLambdaService004, "eu-west-1", "111122223333", "lambda", "004", id="lambda-eu-west-1"),
    pytest.param(aws001.AWSECSService005, "sa-east-1", "444455556666", "ecs", "005", id="ecs-sa-east-1"),
    pytest.param(aws001.AWSEKSService006, "ca-central-1", "777788889999", "eks", "006", id="eks-ca-central-1"),
    pytest.param(aws001.AWSDynamoDBService007, "us-east-2", "101010101010", "dynamodb", "007", id="dynamodb-us-east-2"),
    pytest.param(aws001.AWSCloudWatchService008, "eu-north-1", "202020202020", "cloudwatch", "008", id="cloudwatch-eu-north-1"),
    pytest.param(aws001.AWSIAMService009, "ap-northeast-1", "303030303030", "iam", "009", id="iam-ap-northeast-1"),
    pytest.param(aws001.AWSVPCService010, "af-south-1", "404040404040", "vpc", "010", id="vpc-af-south-1"),
    pytest.param(aws001.AWSRoute53Service011, "me-south-1", "505050505050", "route53", "011", id="route53-me-south-1"),
    pytest.param(aws001.AWSSNSService012, "eu-south-1", "606060606060", "sns", "012", id="sns-eu-south-1"),
]


@pytest.mark.parametrize(
    "service_class, region, account_id, service_name, class_index",
    TEST_CASES,
)
def test_service_initialization_sets_expected_fields(
    service_class, region: str, account_id: str, service_name: str, class_index: str
):
    service = service_class(region=region, account_id=account_id)
    _assert_common_fields(service, service_name, class_index, region, account_id)
