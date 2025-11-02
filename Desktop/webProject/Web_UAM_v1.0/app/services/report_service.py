from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import json
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.units import inch
import matplotlib.pyplot as plt
import seaborn as sns
from app.db.models import Project, Dataset, ProjectDataset, Run, ModelMeta, Artifact
from app.storage import storage
from app.services.ml_service import MLService

class ReportService:
    @staticmethod
    def generate_comprehensive_report(
        project_id: str,
        user_id: str,
        db: Session,
        include_eda: bool = True,
        include_models: bool = True,
        format_type: str = "pdf"
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive report for a project including EDA and model results
        """
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get project datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == user_id
        ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        # Get runs and models
        runs = db.query(Run).filter(Run.project_id == project_id).all()
        models = db.query(ModelMeta).join(Run).filter(Run.project_id == project_id).all()

        # Generate report data
        report_data = {
            "project_info": {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "created_at": str(project.created_at),
                "total_datasets": len(datasets),
                "total_runs": len(runs),
                "total_models": len(models)
            },
            "datasets_summary": ReportService._summarize_datasets(datasets),
            "eda_results": {},
            "model_results": {},
            "generated_at": str(datetime.now())
        }

        # Include EDA results if requested
        if include_eda and datasets:
            report_data["eda_results"] = ReportService._generate_eda_summary(datasets)

        # Include model results if requested
        if include_models and models:
            report_data["model_results"] = ReportService._summarize_models(models, runs)

        # Generate the report file
        if format_type.lower() == "pdf":
            report_key = ReportService._generate_pdf_report(project, report_data)
        elif format_type.lower() == "html":
            report_key = ReportService._generate_html_report(project, report_data)
        else:
            raise ValueError(f"Unsupported format: {format_type}")

        # Store report artifact
        artifact = Artifact(
            run_id=runs[0].id if runs else None,
            type="report",
            storage_key=report_key,
            filename=f"project_report_{project_id}.{format_type}",
            metadata_json={
                "format": format_type,
                "includes_eda": include_eda,
                "includes_models": include_models,
                "generated_at": str(datetime.now())
            }
        )
        db.add(artifact)
        db.commit()

        return {
            "report_key": report_key,
            "format": format_type,
            "size": "estimated",  # Could calculate actual size
            "artifact_id": artifact.id
        }

    @staticmethod
    def _summarize_datasets(datasets: List[Dataset]) -> Dict[str, Any]:
        """Summarize dataset information"""
        summary = {
            "total_datasets": len(datasets),
            "total_size": 0,
            "datasets": []
        }

        for dataset in datasets:
            dataset_info = {
                "id": dataset.id,
                "filename": dataset.filename,
                "size": None,  # Size not stored in dataset model
                "rows": dataset.rows,
                "cols": dataset.cols,
                "created_at": str(dataset.uploaded_at)
            }
            summary["datasets"].append(dataset_info)
            # Note: Size calculation removed as it's not stored in dataset model

        return summary

    @staticmethod
    def _generate_eda_summary(datasets: List[Dataset]) -> Dict[str, Any]:
        """Generate EDA summary from stored EDA results"""
        eda_summary = {
            "available_analyses": [],
            "key_insights": []
        }

        for dataset in datasets:
            # Look for EDA artifacts
            eda_key = f"eda/{dataset.id}_eda.json"
            try:
                eda_data = storage.get_object(eda_key)
                if hasattr(eda_data, 'read'):
                    # File-like object
                    eda_content = eda_data.read()
                    if isinstance(eda_content, bytes):
                        eda_json = json.loads(eda_content.decode('utf-8'))
                    else:
                        eda_json = json.loads(eda_content)
                elif isinstance(eda_data, bytes):
                    # Direct bytes
                    eda_json = json.loads(eda_data.decode('utf-8'))
                else:
                    # Try to read if it's an IO object without read method, or convert to string
                    try:
                        # Check if it's an IO object that needs reading
                        if hasattr(eda_data, '__iter__') and hasattr(eda_data, 'seek'):
                            eda_data.seek(0)  # Reset to beginning
                            content = eda_data.read()
                            if isinstance(content, bytes):
                                eda_json = json.loads(content.decode('utf-8'))
                            else:
                                eda_json = json.loads(content)
                        else:
                            # Assume it's already a string or can be converted
                            eda_json = json.loads(str(eda_data))
                    except Exception:
                        # Last resort: try to decode as bytes
                        if isinstance(eda_data, bytes):
                            eda_json = json.loads(eda_data.decode('utf-8'))
                        else:
                            raise

                eda_summary["available_analyses"].append({
                    "dataset_id": dataset.id,
                    "dataset_name": dataset.filename,
                    "analysis_type": "comprehensive_eda",
                    "key_findings": eda_json.get("key_findings", [])
                })

                # Extract key insights
                if "summary_stats" in eda_json:
                    numeric_cols = eda_json["summary_stats"].get("numeric_columns", [])
                    categorical_cols = eda_json["summary_stats"].get("categorical_columns", [])

                    insight = f"Dataset {dataset.filename}: {len(numeric_cols)} numeric, {len(categorical_cols)} categorical columns"
                    eda_summary["key_insights"].append(insight)

            except Exception as e:
                print(f"Could not load EDA for dataset {dataset.id}: {e}")

        return eda_summary

    @staticmethod
    def _summarize_models(models: List[ModelMeta], runs: List[Run]) -> Dict[str, Any]:
        """Summarize model training results"""
        model_summary = {
            "total_models": len(models),
            "best_model": None,
            "model_types": {},
            "performance_metrics": []
        }

        best_score = -float('inf')
        best_model_info = None

        for model in models:
            # Get run info
            run = next((r for r in runs if r.id == model.run_id), None)
            if not run:
                continue

            model_info = {
                "id": model.id,
                "name": model.name,
                "run_id": model.run_id,
                "created_at": str(model.created_at),
                "metrics": model.metrics_json or {},
                "run_status": run.status if run else "unknown"
            }

            model_summary["performance_metrics"].append(model_info)

            # Track model types
            model_type = model.name.split()[0]  # Extract base model type
            model_summary["model_types"][model_type] = model_summary["model_types"].get(model_type, 0) + 1

            # Find best model (assuming higher score is better)
            primary_score = model.metrics_json.get("score", 0) if model.metrics_json else 0
            if primary_score > best_score:
                best_score = primary_score
                best_model_info = model_info

        model_summary["best_model"] = best_model_info

        return model_summary

    @staticmethod
    def _generate_pdf_report(project: Project, report_data: Dict[str, Any]) -> str:
        """Generate PDF report"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center
        )
        story.append(Paragraph(f"Project Report: {project.name}", title_style))
        story.append(Spacer(1, 12))

        # Project Info
        story.append(Paragraph("Project Information", styles['Heading2']))
        project_info = report_data["project_info"]
        info_text = f"""
        <b>Project ID:</b> {project_info['id']}<br/>
        <b>Description:</b> {project_info.get('description', 'N/A')}<br/>
        <b>Created:</b> {project_info['created_at']}<br/>
        <b>Datasets:</b> {project_info['total_datasets']}<br/>
        <b>Models Trained:</b> {project_info['total_models']}<br/>
        <b>Training Runs:</b> {project_info['total_runs']}
        """
        story.append(Paragraph(info_text, styles['Normal']))
        story.append(Spacer(1, 12))

        # Datasets Summary
        story.append(Paragraph("Datasets Summary", styles['Heading2']))
        datasets = report_data["datasets_summary"]
        dataset_data = [["Filename", "Rows", "Columns", "Size"]]
        for ds in datasets["datasets"]:
            dataset_data.append([
                ds["filename"],
                str(ds.get("rows", "N/A")),
                str(ds.get("cols", "N/A")),
                ds.get("size", "N/A")
            ])

        table = Table(dataset_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
        story.append(Spacer(1, 12))

        # EDA Results
        if report_data["eda_results"]["available_analyses"]:
            story.append(Paragraph("Exploratory Data Analysis", styles['Heading2']))
            for analysis in report_data["eda_results"]["available_analyses"]:
                story.append(Paragraph(f"Dataset: {analysis['dataset_name']}", styles['Heading3']))
                for finding in analysis.get("key_findings", []):
                    story.append(Paragraph(f"• {finding}", styles['Normal']))
                story.append(Spacer(1, 6))

        # Model Results
        if report_data["model_results"]["performance_metrics"]:
            story.append(Paragraph("Model Performance", styles['Heading2']))

            # Best Model
            best_model = report_data["model_results"]["best_model"]
            if best_model:
                story.append(Paragraph("Best Performing Model", styles['Heading3']))
                best_text = f"""
                <b>Model:</b> {best_model['name']}<br/>
                <b>Score:</b> {best_model['metrics'].get('score', 'N/A')}<br/>
                <b>Created:</b> {best_model['created_at']}
                """
                story.append(Paragraph(best_text, styles['Normal']))
                story.append(Spacer(1, 12))

            # Model Comparison Table
            story.append(Paragraph("Model Comparison", styles['Heading3']))
            model_data = [["Model Name", "Primary Score", "Status", "Created"]]
            for model in report_data["model_results"]["performance_metrics"]:
                model_data.append([
                    model["name"],
                    str(model["metrics"].get("score", "N/A")),
                    model.get("run_status", "N/A"),
                    model["created_at"][:10]  # Date only
                ])

            model_table = Table(model_data)
            model_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(model_table)

        # Footer
        story.append(Spacer(1, 24))
        footer_text = f"Report generated on {report_data['generated_at'][:19]}"
        story.append(Paragraph(footer_text, styles['Normal']))

        # Build PDF
        doc.build(story)

        # Save to storage
        buffer.seek(0)
        report_key = f"reports/project_{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        storage.put_object(report_key, buffer.read())

        return report_key

    @staticmethod
    def _generate_html_report(project: Project, report_data: Dict[str, Any]) -> str:
        """Generate HTML report"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Project Report: {project.name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }}
                .section {{ margin: 30px 0; }}
                .table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                .table th, .table td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                .table th {{ background-color: #f2f2f2; }}
                .metric {{ background-color: #e8f4f8; padding: 10px; border-radius: 5px; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Project Report: {project.name}</h1>
                <p>Generated on {report_data['generated_at'][:19]}</p>
            </div>

            <div class="section">
                <h2>Project Information</h2>
                <div class="metric">
                    <strong>Project ID:</strong> {report_data['project_info']['id']}<br>
                    <strong>Description:</strong> {report_data['project_info'].get('description', 'N/A')}<br>
                    <strong>Created:</strong> {report_data['project_info']['created_at']}<br>
                    <strong>Datasets:</strong> {report_data['project_info']['total_datasets']}<br>
                    <strong>Models Trained:</strong> {report_data['project_info']['total_models']}
                </div>
            </div>

            <div class="section">
                <h2>Datasets Summary</h2>
                <table class="table">
                    <tr><th>Filename</th><th>Rows</th><th>Columns</th><th>Size</th></tr>
        """

        for ds in report_data["datasets_summary"]["datasets"]:
            html_content += f"""
                    <tr>
                        <td>{ds['filename']}</td>
                        <td>{ds.get('rows', 'N/A')}</td>
                        <td>{ds.get('cols', 'N/A')}</td>
                        <td>{ds.get('size', 'N/A')}</td>
                    </tr>
            """

        html_content += """
                </table>
            </div>
        """

        # Add EDA section if available
        if report_data["eda_results"]["available_analyses"]:
            html_content += """
            <div class="section">
                <h2>Exploratory Data Analysis</h2>
            """
            for analysis in report_data["eda_results"]["available_analyses"]:
                html_content += f"""
                <h3>Dataset: {analysis['dataset_name']}</h3>
                <ul>
                """
                for finding in analysis.get("key_findings", []):
                    html_content += f"<li>{finding}</li>"
                html_content += "</ul>"
            html_content += "</div>"

        # Add model results if available
        if report_data["model_results"]["performance_metrics"]:
            html_content += """
            <div class="section">
                <h2>Model Performance</h2>
            """

            best_model = report_data["model_results"]["best_model"]
            if best_model:
                html_content += f"""
                <div class="metric">
                    <h3>Best Performing Model</h3>
                    <strong>Model:</strong> {best_model['name']}<br>
                    <strong>Score:</strong> {best_model['metrics'].get('score', 'N/A')}<br>
                    <strong>Created:</strong> {best_model['created_at']}
                </div>
                """

            html_content += """
                <h3>Model Comparison</h3>
                <table class="table">
                    <tr><th>Model Name</th><th>Primary Score</th><th>Status</th><th>Created</th></tr>
            """

            for model in report_data["model_results"]["performance_metrics"]:
                html_content += f"""
                    <tr>
                        <td>{model['name']}</td>
                        <td>{model['metrics'].get('score', 'N/A')}</td>
                        <td>{model.get('run_status', 'N/A')}</td>
                        <td>{model['created_at'][:10]}</td>
                    </tr>
                """

            html_content += """
                </table>
            </div>
        """

        html_content += """
        </body>
        </html>
        """

        # Save to storage
        report_key = f"reports/project_{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        storage.put_object(report_key, html_content.encode('utf-8'))

        return report_key
