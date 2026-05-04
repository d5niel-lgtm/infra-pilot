from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import modules.aws_extended_001 as aws001


def _assert_common_fields(obj, service_name: str, class_index: str, region: str, account_id: str):
    assert obj.service_name == service_name
    assert obj.region == region
    assert obj.account_id == account_id
    assert obj.cluster_name == f"cluster-{region}"
    assert obj.terraform_workspace == f"ws-{account_id[-4:]}-{region}"
    assert obj.resource_prefix == f"demo-{service_name}-{region}"
    assert obj.tags == {
        "owner": "ml-training",
        "service": service_name,
        "workspace": obj.terraform_workspace,
    }
    assert obj.retry_attempts == 3
    assert obj.timeout_seconds == 30
    assert obj.metadata == {
        "dataset_chunk": "001",
        "class_index": class_index,
        "domain": "aws-k8s-terraform",
    }


TEST_CASES = [
    (aws001.AWSEC2Service001, "eu-central-1", "123456789012", "ec2", "001"),
    (aws001.AWSS3Service002, "us-west-2", "210987654321", "s3", "002"),
    (aws001.AWSRDSService003, "ap-southeast-1", "555544443333", "rds", "003"),
    (aws001.AWSLambdaService004, "eu-west-1", "111122223333", "lambda", "004"),
    (aws001.AWSECSService005, "sa-east-1", "444455556666", "ecs", "005"),
    (aws001.AWSEKSService006, "ca-central-1", "777788889999", "eks", "006"),
    (aws001.AWSDynamoDBService007, "us-east-2", "101010101010", "dynamodb", "007"),
    (aws001.AWSCloudWatchService008, "eu-north-1", "202020202020", "cloudwatch", "008"),
    (aws001.AWSIAMService009, "ap-northeast-1", "303030303030", "iam", "009"),
    (aws001.AWSVPCService010, "af-south-1", "404040404040", "vpc", "010"),
    (aws001.AWSRoute53Service011, "me-south-1", "505050505050", "route53", "011"),
    (aws001.AWSSNSService012, "eu-south-1", "606060606060", "sns", "012"),
]


@pytest.mark.parametrize(
    "service_class, region, account_id, service_name, class_index",
    TEST_CASES,
    ids=[f"{service_name}-{region}" for _, region, _, service_name, _ in TEST_CASES],
)
def test_service_initialization_sets_expected_fields(
    service_class, region: str, account_id: str, service_name: str, class_index: str
):
    service = service_class(region=region, account_id=account_id)
    _assert_common_fields(service, service_name, class_index, region, account_id)
